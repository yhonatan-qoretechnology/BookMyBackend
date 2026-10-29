import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  EmpresaCuentaPago,
  EstadoLiquidacionWise,
  LiquidacionWise,
  MetodoCobroOnline,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { isAxiosError } from 'axios';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearLiquidacionWiseDto } from './dto/crear-liquidacion-wise.dto';

/**
 * Liquidaciones a negocios vía Wise — Bookmy les paga/liquida fondos, NO
 * cobra a los clientes (eso lo hace, simulado, PaymentService).
 *
 * Modelo: Bookmy cobra al cliente y paga al negocio desde SU cuenta Wise.
 * El negocio solo entrega dónde recibir (EmpresaCuentaPago: email de Wise o
 * IBAN), nunca credenciales: el OAuth de Wise es solo para socios aprobados
 * y pedir claves bancarias es un riesgo legal (PSD2) y de seguridad.
 *
 * Sin WISE_API_KEY/WISE_API_URL/WISE_PROFILE_ID en el entorno, isEnabled()
 * es false: las liquidaciones se registran igual (PENDIENTE) pero nunca se
 * llama a Wise, así que se puede desplegar sin credenciales. Con el
 * sandbox (WISE_API_URL=https://api.wise-sandbox.com) además se usan los
 * simuladores de Wise para llevar la transferencia a completada.
 */

/** Parte del pago que se queda Bookmy (0 = todo para el negocio). */
export const COMISION_BOOKMY = 0;

/** Métodos que cobra Bookmy y por tanto hay que liquidar al negocio. En
    efectivo el negocio ya tiene el dinero. */
const METODOS_ONLINE: PaymentMethod[] = [PaymentMethod.CARD, PaymentMethod.WISE];

interface WiseQuote {
  id: string;
}
interface WiseTransfer {
  id: number;
  status: string;
}
interface WiseFunding {
  status: string;
  errorCode?: string | null;
}

@Injectable()
export class WiseService {
  private readonly logger = new Logger(WiseService.name);
  private enabledCache: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  isEnabled(): boolean {
    if (this.enabledCache !== null) return this.enabledCache;
    const apiKey = this.configService.get<string>('WISE_API_KEY');
    const apiUrl = this.configService.get<string>('WISE_API_URL');
    const profileId = this.configService.get<string>('WISE_PROFILE_ID');
    this.enabledCache = Boolean(apiKey && apiUrl && profileId);
    return this.enabledCache;
  }

  private isSandbox() {
    return (this.configService.get<string>('WISE_API_URL') ?? '').includes('sandbox');
  }

  private get profileId() {
    return Number(this.configService.get<string>('WISE_PROFILE_ID'));
  }

  private async request<T>(method: 'get' | 'post', path: string, body?: unknown): Promise<T> {
    const apiUrl = this.configService.get<string>('WISE_API_URL');
    const apiKey = this.configService.get<string>('WISE_API_KEY');
    const { data } = await firstValueFrom(
      this.httpService.request<T>({
        method,
        url: `${apiUrl}${path}`,
        data: body,
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    return data;
  }

  /** Mensaje legible de un error de Wise ("Invalid IBAN"...) para el log
      y, al validar la cuenta, para el propio negocio. */
  private describirError(error: unknown): string {
    if (isAxiosError(error)) {
      const data = error.response?.data as
        | { errors?: { message?: string }[]; error_description?: string; message?: string }
        | undefined;
      const mensajes = data?.errors?.map((e) => e.message).filter(Boolean);
      if (mensajes?.length) return mensajes.join('; ');
      return data?.error_description ?? data?.message ?? error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Crea en Wise el destinatario de la cuenta del negocio. Wise valida ahí
   * el IBAN o el email: si no es válido lanza BadRequest con su motivo, para
   * que el negocio lo corrija antes de guardar. Null si Wise no está
   * configurado (se guarda sin validar).
   */
  async crearDestinatario(
    cuenta: Pick<EmpresaCuentaPago, 'metodo' | 'wiseEmail' | 'bancoTitular' | 'bancoNumero'>,
    nombreEmpresa: string,
  ): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const base = {
      profile: this.profileId,
      currency: 'EUR',
      accountHolderName: cuenta.bancoTitular?.trim() || nombreEmpresa,
    };
    const body =
      cuenta.metodo === MetodoCobroOnline.WISE
        ? { ...base, type: 'email', details: { email: cuenta.wiseEmail } }
        : {
            ...base,
            type: 'iban',
            details: {
              legalType: 'BUSINESS',
              IBAN: cuenta.bancoNumero?.replace(/\s+/g, '').toUpperCase(),
            },
          };

    try {
      const destinatario = await this.request<{ id: number }>('post', '/v1/accounts', body);
      return String(destinatario.id);
    } catch (error) {
      const motivo = this.describirError(error);
      this.logger.warn(`Wise rechazó la cuenta de "${nombreEmpresa}": ${motivo}`);
      throw new BadRequestException(`Wise no aceptó la cuenta: ${motivo}`);
    }
  }

  /** Alta manual (SUPER_ADMIN): registra la liquidación y la envía. */
  async crear(dto: CrearLiquidacionWiseDto) {
    const liquidacion = await this.prisma.liquidacionWise.create({
      data: {
        empresaId: dto.empresaId,
        monto: dto.monto,
        moneda: dto.moneda ?? 'EUR',
      },
    });
    return this.enviar(liquidacion);
  }

  /**
   * Liquida al negocio un pago online ya cobrado. Best-effort: nunca lanza,
   * para no tumbar el pago del cliente; lo que falle queda en la propia
   * liquidación (FALLIDA o PENDIENTE con el motivo).
   */
  async liquidarPago(paymentId: number): Promise<LiquidacionWise | null> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { appointment: { include: { sede: true } }, liquidacionWise: true },
      });
      if (!payment || payment.status !== PaymentStatus.PAID) return null;
      if (!METODOS_ONLINE.includes(payment.method)) return null;
      // Ya liquidado (p. ej. reintento): paymentId es único.
      if (payment.liquidacionWise) return payment.liquidacionWise;

      const monto = Number((payment.totalAmount * (1 - COMISION_BOOKMY)).toFixed(2));
      if (monto <= 0) return null;

      const liquidacion = await this.prisma.liquidacionWise.create({
        data: {
          empresaId: payment.appointment.sede.empresaId,
          paymentId: payment.id,
          monto,
          moneda: 'EUR',
        },
      });
      return await this.enviar(liquidacion);
    } catch (error) {
      this.logger.error(`No se pudo liquidar el pago ${paymentId}: ${this.describirError(error)}`);
      return null;
    }
  }

  /**
   * Envía una liquidación: cotización → transferencia → pago desde el saldo
   * de Bookmy. En el sandbox, además, simula el resto del recorrido hasta
   * que el dinero "llega". Nunca lanza: el resultado queda en la fila.
   */
  private async enviar(liquidacion: LiquidacionWise): Promise<LiquidacionWise> {
    const guardar = (
      estado: EstadoLiquidacionWise,
      respuesta: object,
      extra: Partial<Pick<LiquidacionWise, 'wiseQuoteId' | 'wiseRecipientId' | 'wiseTransferId'>> = {},
    ) =>
      this.prisma.liquidacionWise.update({
        where: { id: liquidacion.id },
        data: { estado, respuestaWise: respuesta, ...extra },
      });

    if (!this.isEnabled()) {
      this.logger.warn(
        `Wise no está configurado: liquidación ${liquidacion.id} queda PENDIENTE sin llamar a la API.`,
      );
      return liquidacion;
    }

    const cuenta = await this.prisma.empresaCuentaPago.findUnique({
      where: { empresaId: liquidacion.empresaId },
    });
    if (!cuenta?.wiseRecipientId) {
      return guardar(EstadoLiquidacionWise.PENDIENTE, {
        motivo: 'El negocio no tiene una cuenta de cobro validada en Wise.',
      });
    }

    const recipientId = cuenta.wiseRecipientId;
    let quoteId: string | undefined;
    let transferId: string | undefined;
    try {
      const quote = await this.request<WiseQuote>(
        'post',
        `/v3/profiles/${this.profileId}/quotes`,
        {
          sourceCurrency: 'EUR',
          targetCurrency: liquidacion.moneda,
          targetAmount: liquidacion.monto,
          targetAccount: Number(recipientId),
        },
      );
      quoteId = quote.id;

      const transfer = await this.request<WiseTransfer>('post', '/v1/transfers', {
        targetAccount: Number(recipientId),
        quoteUuid: quote.id,
        // Idempotencia en Wise: reintentar con el mismo id no duplica.
        customerTransactionId: randomUUID(),
        details: { reference: `Bookmy ${liquidacion.id}` },
      });
      transferId = String(transfer.id);

      let funding: WiseFunding;
      try {
        funding = await this.request<WiseFunding>(
          'post',
          `/v3/profiles/${this.profileId}/transfers/${transfer.id}/payments`,
          { type: 'BALANCE' },
        );
      } catch (error) {
        // Con un token personal Wise no deja fondear por API (403) salvo en
        // algunos países: la transferencia ya está creada y se paga a mano
        // desde Wise. No es un fallo, queda PENDIENTE de ese clic.
        if (!isAxiosError(error) || error.response?.status !== 403) throw error;
        return guardar(
          EstadoLiquidacionWise.PENDIENTE,
          { transfer, motivo: 'Transferencia creada en Wise: falta pagarla desde la web de Wise.' },
          { wiseQuoteId: quoteId, wiseRecipientId: recipientId, wiseTransferId: transferId },
        );
      }
      if (funding.status !== 'COMPLETED') {
        return guardar(
          EstadoLiquidacionWise.FALLIDA,
          { transfer, funding },
          { wiseQuoteId: quoteId, wiseRecipientId: recipientId, wiseTransferId: transferId },
        );
      }

      // Wise no simula transferencias a destinatarios por email.
      if (this.isSandbox() && cuenta.metodo !== MetodoCobroOnline.WISE) {
        await this.simularEntrega(transfer.id);
        return guardar(
          EstadoLiquidacionWise.COMPLETADA,
          { transfer, funding, sandbox: true },
          { wiseQuoteId: quoteId, wiseRecipientId: recipientId, wiseTransferId: transferId },
        );
      }

      // En producción la entrega tarda: queda ENVIADA hasta confirmarla.
      return guardar(
        EstadoLiquidacionWise.ENVIADA,
        { transfer, funding },
        { wiseQuoteId: quoteId, wiseRecipientId: recipientId, wiseTransferId: transferId },
      );
    } catch (error) {
      const motivo = this.describirError(error);
      this.logger.error(`Falló la liquidación ${liquidacion.id} en Wise: ${motivo}`);
      return guardar(
        EstadoLiquidacionWise.FALLIDA,
        { error: motivo },
        { wiseQuoteId: quoteId, wiseRecipientId: recipientId, wiseTransferId: transferId },
      );
    }
  }

  /** Solo sandbox: Wise no mueve dinero real, así que se le pide que haga
      avanzar la transferencia por sus estados hasta "enviada". Wise pide
      al menos 5 s entre pasos porque los procesa en segundo plano. */
  private async simularEntrega(transferId: number) {
    for (const paso of ['processing', 'funds_converted', 'outgoing_payment_sent']) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await this.request('get', `/v1/simulation/transfers/${transferId}/${paso}`);
    }
  }

  async listar(empresaId?: number) {
    return this.prisma.liquidacionWise.findMany({
      where: empresaId ? { empresaId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { empresa: { select: { id: true, nombre: true } } },
    });
  }

  async buscar(id: number) {
    const liquidacion = await this.prisma.liquidacionWise.findUnique({
      where: { id },
      include: { empresa: { select: { id: true, nombre: true } } },
    });
    if (!liquidacion) throw new NotFoundException('La liquidación no existe.');
    return liquidacion;
  }
}
