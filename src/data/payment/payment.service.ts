import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  PaymentCard as PaymentCardModel,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
// stripe es CommonJS (`export =`): ver stripe.service.ts.
import Stripe = require('stripe');
import { PrismaService } from 'src/prisma/prisma.service';
import { WiseService } from '../wise/wise.service';
import { StripeService } from './stripe.service';
import { CreatePaymentCardDto } from './dto/create-payment-card.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentItemDto } from './dto/create-payment-item.dto';
import { UpdatePaymentCardDto } from './dto/update-payment-card.dto';

type ListPaymentsFilters = {
  userId?: number;
  sedeId?: number;
};

type CardPaymentPayload = {
  cardNumber?: string;
  cardToken?: string;
  expiryMonth: number;
  expiryYear: number;
  cvv?: string;
  amount: number;
  cardholderName?: string;
  cardBrand?: string;
};

/** Copia apta para el historial: sin client_secret ni otras claves. */
function sinSecretos(datos: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(datos, (clave, valor) => (/secret/i.test(clave) ? undefined : valor)),
  );
}

/** Lo útil de un error de Stripe (tipo, código, motivo del banco). */
function errorDeStripe(error: unknown) {
  const e = error as { message?: string; type?: string; code?: string; decline_code?: string; statusCode?: number };
  return {
    mensaje: e.message,
    tipo: e.type,
    codigo: e.code,
    motivoBanco: e.decline_code,
    http: e.statusCode,
  };
}

/** Stripe da a veces el id y a veces el objeto expandido. */
function idDe(ref: string | { id: string } | null | undefined) {
  return typeof ref === 'string' ? ref : ref?.id;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private wiseService: WiseService,
    private stripeService: StripeService,
  ) {}

  /* ── Alcance ─────────────────────────────────────────────────────
     Antes ninguna ruta de pagos miraba quién llamaba: cualquier sesión
     confirmaba, cancelaba o tocaba los adicionales de cualquier factura, y
     los listados devolvían los pagos de todas las empresas. */

  private esAdminDeNegocio(user: AuthenticatedUser) {
    return (
      user.role === Role.COMPANY_ADMIN || user.role === Role.BRANCH_ADMIN
    );
  }

  /** Los pagos que `user` puede ver: los de su negocio, o los suyos. */
  private alcancePagos(user: AuthenticatedUser): Prisma.PaymentWhereInput {
    if (user.role === Role.SUPER_ADMIN) return {};
    if (user.role === Role.COMPANY_ADMIN && user.empresaId)
      return { appointment: { sede: { empresaId: user.empresaId } } };
    if (user.role === Role.BRANCH_ADMIN && user.sedeId)
      return { appointment: { sedeId: user.sedeId } };
    return { userId: user.userId };
  }

  /**
   * El pago, si `user` lo administra (su negocio) o, con `tambienDueno`, si
   * es el cliente que lo hizo. Si no, 403.
   */
  private async pagoEnAlcance(
    paymentId: number,
    user: AuthenticatedUser,
    { tambienDueno = false } = {},
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        appointment: {
          select: { sedeId: true, sede: { select: { empresaId: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('El pago no existe');

    const cita = payment.appointment;
    const permitido =
      user.role === Role.SUPER_ADMIN ||
      (user.role === Role.COMPANY_ADMIN &&
        !!user.empresaId &&
        cita?.sede?.empresaId === user.empresaId) ||
      (user.role === Role.BRANCH_ADMIN &&
        !!user.sedeId &&
        cita?.sedeId === user.sedeId) ||
      (tambienDueno && payment.userId === user.userId);

    if (!permitido) throw new ForbiddenException('Este pago no es suyo.');
    return payment;
  }

  /**
   * @param importeDelServidor el llamador ya calculó `dto.amount` en el
   *        servidor (reparto de una cita dividida), así que vale aunque
   *        quien reserve sea un cliente.
   */
  async createPayment(
    dto: CreatePaymentDto,
    user: AuthenticatedUser | undefined,
    { importeDelServidor = false } = {},
  ) {
    if (!user) throw new ForbiddenException('Hace falta una sesión.');

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        service: { include: { prices: true } },
        sede: { select: { empresaId: true } },
      },
    });

    if (!appointment) throw new BadRequestException('La cita no existe');

    if (appointment.userId !== dto.userId)
      throw new BadRequestException('La cita no pertenece al usuario indicado');

    /* La cita tiene que ser del usuario de la sesión, o de un cliente del
       negocio de quien cobra. Antes `userId` lo ponía el cliente sin más. */
    const puedeCobrar =
      user.role === Role.SUPER_ADMIN ||
      appointment.userId === user.userId ||
      (user.role === Role.COMPANY_ADMIN &&
        !!user.empresaId &&
        appointment.sede?.empresaId === user.empresaId) ||
      (user.role === Role.BRANCH_ADMIN &&
        !!user.sedeId &&
        appointment.sedeId === user.sedeId);
    if (!puedeCobrar) throw new ForbiddenException('Esta cita no es suya.');

    const priceMatch = appointment.service.prices.find(
      (price) => price.duration === appointment.duracion,
    );

    /* El importe lo fija el servidor. Solo el negocio (o Bookmy) puede
       cobrar otra cantidad; el cliente pagaba lo que él mismo escribía. */
    const importeManual =
      importeDelServidor ||
      user.role === Role.SUPER_ADMIN ||
      this.esAdminDeNegocio(user)
        ? dto.amount
        : undefined;

    const totalAmount =
      importeManual ??
      priceMatch?.amount ??
      appointment.service.prices[0]?.amount ??
      0;

    if (totalAmount <= 0)
      throw new BadRequestException(
        'No fue posible determinar el monto a pagar',
      );

    const reservedAmount =
      dto.method === PaymentMethod.CASH
        ? Number((totalAmount * 0.2).toFixed(2))
        : null;

    let payment = await this.prisma.payment.create({
      data: {
        appointmentId: dto.appointmentId,
        userId: dto.userId,
        serviceId: appointment.serviceId,
        method: dto.method,
        totalAmount,
        reservedAmount,
        paidAmount: 0,
        status: PaymentStatus.PENDING,
      },
    });

    // Pago online real: queda PENDING y la app abre la hoja de pago de
    // Stripe (prepararCobroStripe). Lo marca PAID Stripe, no esta llamada.
    if (dto.method === PaymentMethod.CARD && dto.pagoOnline) {
      if (!this.stripeService.isEnabled())
        throw new BadRequestException(
          'El pago online no está disponible en este momento.',
        );
      await this.registrarEvento(payment.id, 'creado', 'app', {
        importe: payment.totalAmount,
        citaId: payment.appointmentId,
        usuarioId: payment.userId,
      });
      return payment;
    }

    /* Tarjeta registrada por el negocio (o por Bookmy) desde el panel: es
       un cobro con su propio datáfono, en el local. El dinero ya entró y
       no pasa por Stripe, así que queda pagado. Antes caía en el bloque de
       abajo y la factura salía FAILED. */
    if (
      dto.method === PaymentMethod.CARD &&
      (user.role === Role.SUPER_ADMIN || this.esAdminDeNegocio(user))
    ) {
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAmount: payment.totalAmount,
          bankResponse: {
            method: 'DATAFONO',
            registradoPor: user.userId,
            registradoEn: new Date().toISOString(),
          },
        },
      });
    }

    /* Sin pasarela, el "banco" es simulateBankResponse, que aprueba todo:
       la reserva quedaba pagada sin cobrar nada. Fuera de desarrollo, la
       tarjeta va solo por Stripe (pagoOnline). */
    if (
      dto.method === PaymentMethod.CARD &&
      process.env.PAGOS_TARJETA_SIMULADOS !== 'true'
    ) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException(
        'El pago con tarjeta se hace por el pago online.',
      );
    }

    if (dto.method === PaymentMethod.CARD) {
      const { cardRecord, payload } = await this.resolveCardForPayment(
        dto,
        payment.totalAmount,
      );

      if (cardRecord) {
        payment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: { cardId: cardRecord.id },
        });
      }

      return this.processCardPayment(payment, payload);
    }

    if (dto.method === PaymentMethod.WISE) {
      return this.processWisePayment(payment);
    }

    return this.processPartialPayment(payment);
  }

  /**
   * Simulador local del banco — reemplaza la llamada a api.fakebank.com,
   * que nunca fue un banco real (era un dominio externo de placeholder,
   * ahora parkeado/en venta, fallando cada vez más seguido). Esto no
   * depende de internet ni de un tercero fuera de nuestro control: se
   * comporta como respondería un banco fake, pero corriendo acá adentro.
   * Cuando haya un gateway real (Stripe, Redsys, etc.), este método es el
   * punto exacto a reemplazar.
   */
  private async simulateBankResponse(
    prefix: string,
    paymentId: number,
    amount: number,
  ) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      transactionId: `${prefix}-${paymentId}-${Date.now()}`,
      amount,
      currency: 'EUR',
      status: 'approved',
      simulated: true,
    };
  }

  // 💳 Pago completo con tarjeta
  private async processCardPayment(payment, payload: CardPaymentPayload) {
    try {
      const data = await this.simulateBankResponse(
        'TXN',
        payment.id,
        payload.amount ?? payment.totalAmount,
      );

      const paid = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: data.transactionId,
          bankResponse: data,
          status: PaymentStatus.PAID,
          paidAmount: payment.totalAmount,
        },
      });
      /* No se liquida al negocio: este cobro es simulado y no ha entrado
         dinero. Antes se le transfería de verdad, por Wise, el 90 % de un
         importe que el propio cliente elegía. */
      return paid;
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Error al procesar el pago con tarjeta');
    }
  }

  /**
   * Wise: no hay pasarela que cobre al cliente — paga por transferencia
   * bancaria manual a la cuenta de Bookmy. El pago queda PENDING con los
   * datos de la cuenta y una referencia; alguien de Bookmy lo confirma a
   * mano cuando ve la transferencia llegar (confirmWiseTransfer), y ahí
   * recién se liquida al negocio.
   */
  private async processWisePayment(payment) {
    const cuenta = this.wiseService.cuentaReceptora();
    const datos = {
      method: 'WISE_TRANSFERENCIA',
      referencia: `BOOKMY-${payment.id}`,
      monto: payment.totalAmount,
      moneda: 'EUR',
      cuenta,
    };
    const pendiente = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { bankResponse: datos },
    });
    await this.registrarEvento(payment.id, 'creado', 'app', datos);
    return pendiente;
  }

  /** Transferencias Wise que esperan a que Bookmy confirme su llegada. */
  async transferenciasWisePendientes() {
    return this.prisma.payment.findMany({
      where: { method: PaymentMethod.WISE, status: PaymentStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        totalAmount: true,
        bankResponse: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
        appointment: {
          select: {
            id: true,
            horaInicio: true,
            notas: true,
            estado: true,
            sede: { select: { id: true, nombre: true, empresa: { select: { id: true, nombre: true } } } },
          },
        },
      },
    });
  }

  /**
   * Confirma a mano que la transferencia del pago WISE llegó a la cuenta de
   * Bookmy (lo hace alguien de Bookmy mirando su propia cuenta — no hay API
   * para leer esa llegada automáticamente). Marca el pago como PAID y recién
   * ahí dispara la liquidación al negocio.
   */
  async confirmWiseTransfer(paymentId: number, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new BadRequestException('El pago no existe');
    if (payment.method !== PaymentMethod.WISE)
      throw new BadRequestException('El pago no es por transferencia Wise');
    if (payment.status !== PaymentStatus.PENDING)
      throw new BadRequestException('El pago no está pendiente de transferencia');

    const confirmacion = {
      confirmadoEn: new Date().toISOString(),
      confirmadoPor: user.userId,
    };
    // Solo una confirmación gana el paso PENDING → PAID (doble clic, dos admins).
    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.PAID,
        paidAmount: payment.totalAmount,
        bankResponse: { ...(payment.bankResponse as object), ...confirmacion },
      },
    });
    if (count > 0) {
      await this.registrarEvento(paymentId, 'transferencia_confirmada', 'sistema', {
        ...confirmacion,
        importe: payment.totalAmount,
      });
      await this.liquidarYRegistrar(paymentId);
    }
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  // 💵 Pago parcial en establecimiento
  private async processPartialPayment(payment) {
    const reserved = payment.reservedAmount;

    try {
      const data = await this.simulateBankResponse('RSV', payment.id, reserved);

      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: data.transactionId,
          bankResponse: data,
          status: PaymentStatus.RESERVED,
          paidAmount: reserved,
        },
      });
    } catch {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Error al procesar la reserva parcial');
    }
  }

  // Confirmar el pago restante en establecimiento
  /**
   * Actualiza el total de una factura al añadir o quitar un adicional.
   *
   * Suma (o resta) el adicional al total actual en vez de rehacerlo desde
   * la tarifa del servicio: si el negocio cobró la base a mano (precio
   * libre en «Nueva factura»), recalcular desde la tarifa la pisaba.
   */
  private async recalcularTotal(paymentId: number, delta: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new BadRequestException('La factura no existe');

    const totalAmount = Math.max(
      0,
      Number((payment.totalAmount + delta).toFixed(2)),
    );

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { totalAmount },
      include: { items: true },
    });
  }

  /** Adicionales de una factura. */
  async listPaymentItems(paymentId: number, user: AuthenticatedUser) {
    await this.pagoEnAlcance(paymentId, user);
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!payment) throw new BadRequestException('La factura no existe');
    return payment.items;
  }

  /** Anade un concepto adicional y actualiza el total. */
  async addPaymentItem(
    paymentId: number,
    dto: CreatePaymentItemDto,
    user: AuthenticatedUser,
  ) {
    await this.pagoEnAlcance(paymentId, user);
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new BadRequestException('La factura no existe');

    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.FAILED
    ) {
      throw new BadRequestException(
        'No se pueden anadir adicionales a una factura cancelada o fallida',
      );
    }

    await this.prisma.paymentItem.create({
      data: {
        paymentId,
        concepto: dto.concepto.trim(),
        cantidad: dto.cantidad,
        precioUnitario: dto.precioUnitario,
        moneda: dto.moneda ?? null,
      },
    });

    return this.recalcularTotal(paymentId, dto.cantidad * dto.precioUnitario);
  }

  /** Quita un adicional y actualiza el total. */
  async removePaymentItem(itemId: number, user: AuthenticatedUser) {
    const item = await this.prisma.paymentItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new BadRequestException('El adicional no existe');
    await this.pagoEnAlcance(item.paymentId, user);

    await this.prisma.paymentItem.delete({ where: { id: itemId } });
    return this.recalcularTotal(
      item.paymentId,
      -(item.cantidad * item.precioUnitario),
    );
  }

  async confirmRemainingPayment(paymentId: number, user: AuthenticatedUser) {
    // Lo confirma el negocio al cobrar en el local, no el cliente.
    const payment = await this.pagoEnAlcance(paymentId, user);

    if (!payment || payment.status !== 'RESERVED')
      throw new BadRequestException('El pago no está reservado o no existe');

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidAmount: payment.totalAmount,
      },
    });
  }

  /* ── Pago online con Stripe ──────────────────────────────────────── */

  /** El pago tiene que ser del usuario de la sesión (o SUPER_ADMIN). */
  private async pagoOnlineDe(paymentId: number, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: { select: { email: true, stripeCustomerId: true } } },
    });
    if (!payment) throw new NotFoundException('El pago no existe');
    if (user.role !== Role.SUPER_ADMIN && payment.userId !== user.userId)
      throw new ForbiddenException('Este pago no es suyo.');
    if (payment.method !== PaymentMethod.CARD)
      throw new BadRequestException('Este pago no es un pago online.');
    return payment;
  }

  /** Datos para abrir la hoja de pago de Stripe en la app. */
  async prepararCobroStripe(paymentId: number, user: AuthenticatedUser) {
    const payment = await this.pagoOnlineDe(paymentId, user);
    if (payment.status !== PaymentStatus.PENDING)
      throw new BadRequestException('Este pago ya no está pendiente.');

    let cobro: Awaited<ReturnType<StripeService['prepararCobro']>>;
    try {
      cobro = await this.stripeService.prepararCobro({
        paymentId: payment.id,
        appointmentId: payment.appointmentId,
        userId: payment.userId,
        email: payment.user.email,
        monto: payment.totalAmount,
        intentExistente: payment.transactionId,
        customerIdGuardado: payment.user.stripeCustomerId,
      });
    } catch (error) {
      await this.registrarEvento(payment.id, 'error_preparar', 'stripe', errorDeStripe(error));
      throw error;
    }

    if (payment.transactionId !== cobro.paymentIntentId)
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: cobro.paymentIntentId },
      });
    // Así el próximo pago encuentra sus tarjetas guardadas al momento.
    if (payment.user.stripeCustomerId !== cobro.customerId)
      await this.prisma.users.update({
        where: { id: payment.userId },
        data: { stripeCustomerId: cobro.customerId },
      });
    await this.registrarEvento(payment.id, 'preparado', 'app', {
      paymentIntent: cobro.paymentIntentId,
      cliente: cobro.customerId,
      reintento: payment.transactionId === cobro.paymentIntentId,
    });
    return cobro;
  }

  /**
   * La app lo llama al cerrarse la hoja de pago con éxito. No se fía de la
   * app: le pregunta a Stripe si el cobro está hecho. El webhook hace lo
   * mismo por si la app se cierra antes de llamar.
   */
  async confirmarCobroStripe(paymentId: number, user: AuthenticatedUser) {
    const payment = await this.pagoOnlineDe(paymentId, user);
    if (payment.status === PaymentStatus.PAID) return payment;
    if (!payment.transactionId?.startsWith('pi_'))
      throw new BadRequestException('Este pago no tiene un cobro de Stripe.');
    const intent = await this.stripeService.obtenerCobro(payment.transactionId);
    if (intent.status !== 'succeeded') {
      await this.registrarEvento(payment.id, 'confirmacion_sin_cobro', 'app', {
        estado: intent.status,
        errorBanco: intent.last_payment_error ?? null,
      });
      throw new BadRequestException(
        `El cobro aún no está completado (estado: ${intent.status}).`,
      );
    }
    return this.marcarCobradoPorStripe(payment.id, intent);
  }

  /** El cliente cerró la hoja sin pagar: se anula el cobro y la cita. */
  async cancelarCobroStripe(paymentId: number, user: AuthenticatedUser) {
    const payment = await this.pagoOnlineDe(paymentId, user);
    if (payment.status !== PaymentStatus.PENDING) return payment;
    if (payment.transactionId?.startsWith('pi_'))
      await this.stripeService.anularCobro(payment.transactionId);
    const [cancelado] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELLED },
      }),
      this.prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: {
          estado: AppointmentStatus.CANCELLED,
          notas: 'Cancelada: el cliente no completó el pago online',
        },
      }),
    ]);
    await this.registrarEvento(payment.id, 'cancelado', 'app', {
      paymentIntent: payment.transactionId,
    });
    return cancelado;
  }

  /**
   * Webhook de Stripe (firma verificada en StripeService). Todo evento queda
   * guardado tal cual en el historial; Stripe reintenta los avisos y el id
   * del evento evita procesar dos veces el mismo.
   */
  async procesarWebhookStripe(rawBody: Buffer | undefined, firma?: string) {
    const evento = this.stripeService.leerWebhook(rawBody, firma);
    const yaVisto = await this.prisma.paymentEvent.findUnique({
      where: { stripeEventId: evento.id },
      select: { id: true },
    });
    if (yaVisto) return { received: true };

    let paymentId: number | null;
    try {
      paymentId = await this.aplicarEventoStripe(evento);
    } catch (error) {
      // Sin el id del evento: así el reintento de Stripe vuelve a probar.
      await this.registrarEvento(null, 'error_webhook', 'stripe', {
        evento: evento.id,
        tipo: evento.type,
        error: (error as Error).message,
      });
      throw error;
    }
    await this.registrarEvento(paymentId, evento.type, 'stripe', evento, evento.id);
    return { received: true };
  }

  /** Aplica el evento al pago y devuelve su id (null si no es de Bookmy). */
  private async aplicarEventoStripe(evento: Stripe.Event): Promise<number | null> {
    switch (evento.type) {
      case 'payment_intent.succeeded': {
        const intent = evento.data.object;
        const paymentId = await this.pagoDeCobro(intent.id, intent.metadata);
        if (paymentId) await this.marcarCobradoPorStripe(paymentId, intent.id);
        return paymentId;
      }

      // El pago sigue PENDING: el cliente puede reintentar desde la app. El
      // motivo del banco (fondos, tarjeta caducada...) queda en el evento.
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const intent = evento.data.object;
        return this.pagoDeCobro(intent.id, intent.metadata);
      }

      case 'charge.refunded': {
        const cargo = evento.data.object;
        const paymentId = await this.pagoDeCobro(idDe(cargo.payment_intent), cargo.metadata);
        if (!paymentId) return null;
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            paidAmount: (cargo.amount_captured - cargo.amount_refunded) / 100,
            // Reembolso parcial: sigue pagado, con el importe que queda.
            ...(cargo.refunded && { status: PaymentStatus.REFUNDED }),
          },
        });
        await this.avisarSiYaLiquidado(paymentId, 'Reembolso');
        return paymentId;
      }

      case 'charge.dispute.created': {
        const disputa = evento.data.object;
        const paymentId = await this.pagoDeCobro(idDe(disputa.payment_intent));
        if (!paymentId) return null;
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.DISPUTED },
        });
        this.logger.error(
          `Disputa ${disputa.id} abierta sobre el pago ${paymentId} (${disputa.reason}). ` +
            'Hay que responderla en el panel de Stripe antes de la fecha límite.',
        );
        await this.avisarSiYaLiquidado(paymentId, 'Disputa');
        return paymentId;
      }

      case 'charge.dispute.closed': {
        const disputa = evento.data.object;
        const paymentId = await this.pagoDeCobro(idDe(disputa.payment_intent));
        // Ganada: el dinero vuelve. Perdida: queda DISPUTED (dinero perdido).
        if (paymentId && disputa.status === 'won')
          await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.PAID },
          });
        return paymentId;
      }

      default: {
        // Cualquier otro aviso se guarda igual, ligado a su pago si se puede.
        const objeto = evento.data.object as {
          object?: string;
          id?: string;
          payment_intent?: string | { id: string } | null;
          metadata?: Record<string, string> | null;
        };
        const intentId =
          objeto.object === 'payment_intent' ? objeto.id : idDe(objeto.payment_intent);
        return this.pagoDeCobro(intentId, objeto.metadata);
      }
    }
  }

  /** El pago de Bookmy de un cobro de Stripe: por la metadata que le pusimos
      al crearlo o, si no la trae (disputas), por el id del cobro. */
  private async pagoDeCobro(
    intentId: string | null | undefined,
    metadata?: Record<string, string> | null,
  ) {
    const id = Number(metadata?.paymentId);
    if (id) return id;
    if (!intentId) return null;
    const pago = await this.prisma.payment.findFirst({
      where: { transactionId: intentId },
      select: { id: true },
    });
    return pago?.id ?? null;
  }

  /** Si el dinero ya se envió al negocio por Wise, Bookmy lo ha devuelto (o
      se lo retienen) sin tenerlo: hay que reclamárselo al negocio. */
  private async avisarSiYaLiquidado(paymentId: number, motivo: string) {
    const liquidacion = await this.prisma.liquidacionWise.findUnique({
      where: { paymentId },
      select: { id: true, estado: true, empresaId: true, monto: true },
    });
    if (!liquidacion) return;
    this.logger.warn(
      `${motivo} del pago ${paymentId}, que ya tiene la liquidación Wise ${liquidacion.id} ` +
        `(${liquidacion.estado}, ${liquidacion.monto} EUR, empresa ${liquidacion.empresaId}).`,
    );
    await this.registrarEvento(paymentId, 'aviso_ya_liquidado', 'sistema', {
      motivo,
      liquidacion,
    });
  }

  /** Idempotente: confirmar y webhook pueden llegar los dos. Solo el
      primero que pasa de PENDING a PAID dispara la liquidación por Wise. */
  private async marcarCobradoPorStripe(
    paymentId: number,
    cobro: string | Stripe.PaymentIntent,
  ) {
    // Se vuelve a pedir con el cargo expandido para guardar tarjeta y recibo.
    const intent =
      typeof cobro === 'string' || typeof cobro.latest_charge !== 'object'
        ? await this.stripeService.obtenerCobro(typeof cobro === 'string' ? cobro : cobro.id)
        : cobro;
    const resumen = this.stripeService.resumenDelCobro(intent);

    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.PAID,
        paidAmount: resumen.importe,
        transactionId: intent.id,
        bankResponse: resumen,
      },
    });
    if (count > 0) {
      await this.registrarEvento(paymentId, 'cobrado', 'stripe', resumen);
      await this.liquidarYRegistrar(paymentId);
    }
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  /** Envía al negocio lo cobrado (Wise) y deja el resultado en el historial. */
  private async liquidarYRegistrar(paymentId: number) {
    try {
      const liquidacion = await this.wiseService.liquidarPago(paymentId);
      await this.registrarEvento(
        paymentId,
        'liquidacion',
        'wise',
        liquidacion
          ? {
              liquidacionId: liquidacion.id,
              estado: liquidacion.estado,
              monto: liquidacion.monto,
              transferencia: liquidacion.wiseTransferId,
            }
          : { estado: 'sin_liquidacion' },
      );
    } catch (error) {
      // El cobro ya está hecho: no se deshace por un fallo de Wise.
      await this.registrarEvento(paymentId, 'error_liquidacion', 'wise', {
        error: (error as Error).message,
      });
    }
  }

  /** Historial de un pago, del más antiguo al más reciente. */
  async eventosDelPago(paymentId: number, user: AuthenticatedUser) {
    await this.pagoEnAlcance(paymentId, user);
    return this.prisma.paymentEvent.findMany({
      where: { paymentId },
      orderBy: { id: 'asc' },
    });
  }

  /** Guarda un paso del pago. Nunca rompe el cobro: si falla, solo queda en
      el log. Un evento de Stripe repetido se ignora (stripeEventId único). */
  private async registrarEvento(
    paymentId: number | null,
    tipo: string,
    origen: 'app' | 'stripe' | 'wise' | 'sistema',
    datos?: unknown,
    stripeEventId?: string,
  ) {
    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId,
          tipo: tipo.slice(0, 40),
          origen,
          stripeEventId,
          ...(datos !== undefined && { datos: sinSecretos(datos) }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return;
      this.logger.error(
        `No se pudo guardar el evento ${tipo} del pago ${paymentId}: ${(error as Error).message}`,
      );
    }
  }

  async cancelPayment(id: number, user: AuthenticatedUser) {
    await this.pagoEnAlcance(id, user, { tambienDueno: true });
    return this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  async listPayments(user: AuthenticatedUser, userId?: number) {
    const payments = await this.prisma.payment.findMany({
      where: { AND: [this.alcancePagos(user), userId ? { userId } : {}] },
      include: this.paymentListInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return this.mapPaymentsList(payments);
  }

  async filterPayments(
    user: AuthenticatedUser,
    filters: ListPaymentsFilters = {},
  ) {
    const { userId, sedeId } = filters;

    const payments = await this.prisma.payment.findMany({
      where: {
        AND: [
          this.alcancePagos(user),
          userId ? { userId } : {},
          sedeId ? { appointment: { sedeId } } : {},
        ],
      },
      include: this.paymentListInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return this.mapPaymentsList(payments);
  }

  private paymentListInclude() {
    return {
      items: true,
      appointment: {
        include: {
          service: { select: { id: true, translations: true } },
        },
      },
      card: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          /* Sin el nombre, el panel pintaba el correo del cliente en la
             lista de facturas y en el PDF. */
          UserData: { select: { name: true, phone: true } },
        },
      },
      service: {
        select: {
          id: true,
          translations: true,
        },
      },
    };
  }

  private mapPaymentsList(payments) {
    return payments.map((payment) => ({
      ...payment,
      card: payment.card ? this.sanitizeCard(payment.card) : null,
    }));
  }

  async createPaymentCard(dto: CreatePaymentCardDto) {
    const brand =
      dto.brand ?? (dto.cardNumber ? this.detectCardBrand(dto.cardNumber) : 'unknown');
    const last4 = dto.last4 ?? dto.cardNumber!.slice(-4);

    const existing = await this.prisma.paymentCard.findFirst({
      where: {
        userId: dto.userId,
        last4,
        expiryMonth: dto.expiryMonth,
        expiryYear: dto.expiryYear,
      },
    });

    const token = randomUUID();

    const card = existing
      ? await this.prisma.paymentCard.update({
          where: { id: existing.id },
          data: {
            brand,
            cardholderName: dto.cardholderName,
            isActive: dto.isActive ?? true,
            token,
          },
        })
      : await this.prisma.paymentCard.create({
          data: {
            userId: dto.userId,
            brand,
            last4,
            expiryMonth: dto.expiryMonth,
            expiryYear: dto.expiryYear,
            cardholderName: dto.cardholderName,
            token,
            isActive: dto.isActive ?? true,
          },
        });

    return this.sanitizeCard(card);
  }

  async listPaymentCards(userId: number) {
    const cards = await this.prisma.paymentCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return cards.map((card) => this.sanitizeCard(card));
  }

  async updatePaymentCard(id: number, dto: UpdatePaymentCardDto) {
    const card = await this.prisma.paymentCard.findUnique({ where: { id } });

    if (!card || card.userId !== dto.userId)
      throw new NotFoundException('Tarjeta no encontrada para el usuario');

    const { userId, ...data } = dto;

    const updated = await this.prisma.paymentCard.update({
      where: { id },
      data,
    });

    return this.sanitizeCard(updated);
  }

  async removePaymentCard(id: number, userId?: number) {
    const card = await this.prisma.paymentCard.findUnique({ where: { id } });

    if (!card || (userId && card.userId !== userId))
      throw new NotFoundException('Tarjeta no encontrada');

    const updated = await this.prisma.paymentCard.update({
      where: { id },
      data: { isActive: false },
    });

    return this.sanitizeCard(updated);
  }

  private async resolveCardForPayment(
    dto: CreatePaymentDto,
    amount: number,
  ): Promise<{
    cardRecord: PaymentCardModel | null;
    payload: CardPaymentPayload;
  }> {
    let cardRecord: PaymentCardModel | null = null;

    if (dto.existingCardId) {
      cardRecord = await this.prisma.paymentCard.findFirst({
        where: {
          id: dto.existingCardId,
          userId: dto.userId,
          isActive: true,
        },
      });

      if (!cardRecord)
        throw new BadRequestException(
          'La tarjeta seleccionada no está disponible para este usuario',
        );

      return {
        cardRecord,
        payload: {
          cardToken: cardRecord.token ?? undefined,
          expiryMonth: cardRecord.expiryMonth,
          expiryYear: cardRecord.expiryYear,
          amount,
          cardholderName: cardRecord.cardholderName,
          cardBrand: cardRecord.brand,
        },
      };
    }

    if (!dto.cardNumber || !dto.expiryMonth || !dto.expiryYear)
      throw new BadRequestException(
        'Debe proporcionar los datos completos de la tarjeta',
      );

    const brand = dto.cardBrand ?? this.detectCardBrand(dto.cardNumber);

    let payload: CardPaymentPayload = {
      cardNumber: dto.cardNumber,
      expiryMonth: dto.expiryMonth,
      expiryYear: dto.expiryYear,
      cvv: dto.cvv,
      amount,
      cardholderName: dto.cardholderName,
      cardBrand: brand,
    };

    if (dto.saveCard) {
      const last4 = dto.cardNumber.slice(-4);

      const existing = await this.prisma.paymentCard.findFirst({
        where: {
          userId: dto.userId,
          last4,
          expiryMonth: dto.expiryMonth,
          expiryYear: dto.expiryYear,
        },
      });

      if (existing) {
        cardRecord = await this.prisma.paymentCard.update({
          where: { id: existing.id },
          data: {
            brand,
            cardholderName: dto.cardholderName ?? existing.cardholderName,
            isActive: true,
          },
        });
      } else {
        cardRecord = await this.prisma.paymentCard.create({
          data: {
            userId: dto.userId,
            brand,
            last4,
            expiryMonth: dto.expiryMonth,
            expiryYear: dto.expiryYear,
            cardholderName: dto.cardholderName ?? 'No especificado',
            token: randomUUID(),
            isActive: true,
          },
        });
      }

      payload = {
        ...payload,
        cardToken: cardRecord.token ?? undefined,
      };
    }

    return { cardRecord, payload };
  }

  private sanitizeCard(card: PaymentCardModel) {
    const { token, ...rest } = card;
    return rest;
  }

  private detectCardBrand(cardNumber: string) {
    const sanitized = cardNumber.replace(/\D/g, '');

    if (/^4\d{12,18}$/.test(sanitized)) return 'visa';
    if (
      /^5[1-5]\d{14}$/.test(sanitized) ||
      /^2(2[2-9]|[3-7]\d)\d{12}$/.test(sanitized)
    )
      return 'mastercard';
    if (/^3[47]\d{13}$/.test(sanitized)) return 'amex';

    return 'desconocida';
  }
}
