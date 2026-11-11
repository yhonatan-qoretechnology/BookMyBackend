import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// stripe es CommonJS (`export =`) y el proyecto no usa esModuleInterop:
// con `import Stripe from` el `.default` sería undefined en ejecución.
import Stripe = require('stripe');

/**
 * Pasarela de cobro al cliente (Stripe). Muestra al cliente con qué pagar
 * (tarjeta, Apple Pay, Google Pay), comprueba con su banco si tiene saldo
 * y responde aprobado/rechazado al momento. Wise NO cobra: solo liquida
 * después al negocio lo que Stripe ya cobró.
 *
 * Sin STRIPE_SECRET_KEY, isEnabled() es false y el pago online se rechaza
 * con un mensaje claro en vez de simularse.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe.Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(config: ConfigService) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    this.client = key ? Stripe(key) : null;
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  isEnabled() {
    return this.client !== null;
  }

  private get stripe(): Stripe.Stripe {
    if (!this.client)
      throw new ServiceUnavailableException(
        'Los pagos online no están configurados (falta STRIPE_SECRET_KEY).',
      );
    return this.client;
  }

  /** Cliente de Stripe del usuario: ahí quedan guardadas sus tarjetas.
      Primero el id guardado en Users; si no hay, se busca por metadata
      (clientes creados antes de la columna) y si no, se crea. */
  private async clienteDe(userId: number, email: string, guardado?: string | null) {
    if (guardado) {
      const cliente = await this.stripe.customers.retrieve(guardado);
      if (!cliente.deleted) return cliente;
    }
    const encontrados = await this.stripe.customers.search({
      query: `metadata['bookmyUserId']:'${userId}'`,
      limit: 1,
    });
    if (encontrados.data[0]) return encontrados.data[0];
    return this.stripe.customers.create({
      email,
      metadata: { bookmyUserId: String(userId) },
    });
  }

  /**
   * Prepara el cobro para la hoja de pago de la app. Si el pago ya tiene un
   * PaymentIntent abierto (el cliente cerró la hoja y vuelve a intentarlo),
   * se reutiliza en vez de crear otro cobro.
   */
  async prepararCobro(params: {
    paymentId: number;
    appointmentId: number;
    userId: number;
    email: string;
    monto: number;
    intentExistente?: string | null;
    customerIdGuardado?: string | null;
  }) {
    const cliente = await this.clienteDe(
      params.userId,
      params.email,
      params.customerIdGuardado,
    );

    let intent: Stripe.PaymentIntent | null = null;
    if (params.intentExistente?.startsWith('pi_')) {
      const previo = await this.stripe.paymentIntents.retrieve(
        params.intentExistente,
      );
      if (!['succeeded', 'canceled'].includes(previo.status)) intent = previo;
    }

    if (!intent) {
      intent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(params.monto * 100),
          currency: 'eur',
          customer: cliente.id,
          // Stripe decide qué métodos mostrar según el dispositivo y lo
          // activado en el panel (tarjeta, Apple Pay, Google Pay...).
          automatic_payment_methods: { enabled: true },
          description: `Reserva Bookmy #${params.appointmentId}`,
          metadata: {
            paymentId: String(params.paymentId),
            appointmentId: String(params.appointmentId),
            bookmyUserId: String(params.userId),
          },
        },
        // Reintentos de la misma petición no crean dos cobros.
        { idempotencyKey: `bookmy-payment-${params.paymentId}` },
      );
    }

    /* La sesión de cliente deja a la hoja de pago mostrar las tarjetas
       guardadas y ofrecer "Guardar para futuras compras". Con la clave
       efímera sola, las tarjetas se guardaban pero la hoja no las volvía a
       mostrar (allow_redisplay quedaba "unspecified"). */
    const sesion = await this.stripe.customerSessions.create({
      customer: cliente.id,
      components: {
        mobile_payment_element: {
          enabled: true,
          features: {
            payment_method_save: 'enabled',
            payment_method_redisplay: 'enabled',
            payment_method_remove: 'enabled',
            payment_method_allow_redisplay_filters: ['always', 'limited', 'unspecified'],
          },
        },
      },
    });
    // La clave efímera queda para las versiones de la app anteriores.
    const clave = await this.stripe.ephemeralKeys.create(
      { customer: cliente.id },
      { apiVersion: '2026-08-26.dahlia' },
    );

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      customerId: cliente.id,
      customerSessionClientSecret: sesion.client_secret,
      ephemeralKey: clave.secret,
    };
  }

  /** El cobro con su cargo (tarjeta, recibo, resultado del banco). */
  obtenerCobro(paymentIntentId: string) {
    return this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
  }

  /** Lo que conviene tener a mano ante una reclamación, sin ir a Stripe. */
  resumenDelCobro(intent: Stripe.PaymentIntent) {
    const cargo =
      intent.latest_charge && typeof intent.latest_charge === 'object'
        ? intent.latest_charge
        : null;
    const tarjeta = cargo?.payment_method_details?.card;
    return {
      pasarela: 'stripe',
      paymentIntent: intent.id,
      cargo: cargo?.id ?? (intent.latest_charge as string | null) ?? null,
      cliente: typeof intent.customer === 'string' ? intent.customer : intent.customer?.id ?? null,
      importe: intent.amount_received / 100,
      moneda: intent.currency,
      metodo: cargo?.payment_method_details?.type ?? null,
      tarjeta: tarjeta
        ? {
            marca: tarjeta.brand,
            ultimos4: tarjeta.last4,
            caduca: `${tarjeta.exp_month}/${tarjeta.exp_year}`,
            pais: tarjeta.country,
            wallet: tarjeta.wallet?.type ?? null,
          }
        : null,
      recibo: cargo?.receipt_url ?? null,
      resultadoBanco: cargo?.outcome
        ? {
            estado: cargo.outcome.network_status,
            motivo: cargo.outcome.reason,
            riesgo: cargo.outcome.risk_level,
          }
        : null,
      cobradoEn: new Date((cargo?.created ?? intent.created) * 1000).toISOString(),
    };
  }

  /** Anula un cobro que el cliente abandonó. Best-effort. */
  async anularCobro(paymentIntentId: string) {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (!['succeeded', 'canceled'].includes(intent.status))
        await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      this.logger.warn(
        `No se pudo anular el cobro ${paymentIntentId}: ${(error as Error).message}`,
      );
    }
  }

  /** Verifica la firma del webhook: sin ella cualquiera podría marcar
      pagos como cobrados llamando a la URL. */
  leerWebhook(rawBody: Buffer | undefined, firma: string | undefined) {
    if (!this.webhookSecret)
      throw new ServiceUnavailableException('Falta STRIPE_WEBHOOK_SECRET.');
    if (!rawBody || !firma)
      throw new BadRequestException('Webhook de Stripe sin cuerpo o sin firma.');
    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        firma,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Firma del webhook de Stripe no válida.');
    }
  }
}
