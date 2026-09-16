import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentCard as PaymentCardModel,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
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

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  async createPayment(dto: CreatePaymentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        service: { include: { prices: true } },
      },
    });

    if (!appointment) throw new BadRequestException('La cita no existe');

    if (appointment.userId !== dto.userId)
      throw new BadRequestException('La cita no pertenece al usuario indicado');

    const priceMatch = appointment.service.prices.find(
      (price) => price.duration === appointment.duracion,
    );

    const totalAmount =
      dto.amount ??
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

      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: data.transactionId,
          bankResponse: data,
          status: PaymentStatus.PAID,
          paidAmount: payment.totalAmount,
        },
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Error al procesar el pago con tarjeta');
    }
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
   * Recalcula el total de una factura: precio base del servicio + adicionales.
   *
   * El precio base se deriva igual que en createPayment (la tarifa del
   * servicio para la duracion de la cita) en vez de guardarse aparte, para
   * que no haya dos fuentes de verdad que puedan separarse.
   */
  private async recalcularTotal(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        items: true,
        appointment: { include: { service: { include: { prices: true } } } },
      },
    });
    if (!payment) throw new BadRequestException('La factura no existe');

    const cita = payment.appointment;
    const tarifa = cita?.service?.prices?.find(
      (precio) => precio.duration === cita.duracion,
    );
    const base = tarifa?.amount ?? cita?.service?.prices?.[0]?.amount ?? 0;

    const adicionales = payment.items.reduce(
      (suma, item) => suma + item.cantidad * item.precioUnitario,
      0,
    );

    const totalAmount = Number((base + adicionales).toFixed(2));

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { totalAmount },
      include: { items: true },
    });
  }

  /** Adicionales de una factura. */
  async listPaymentItems(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!payment) throw new BadRequestException('La factura no existe');
    return payment.items;
  }

  /** Anade un concepto adicional y actualiza el total. */
  async addPaymentItem(paymentId: number, dto: CreatePaymentItemDto) {
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
      },
    });

    return this.recalcularTotal(paymentId);
  }

  /** Quita un adicional y actualiza el total. */
  async removePaymentItem(itemId: number) {
    const item = await this.prisma.paymentItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new BadRequestException('El adicional no existe');

    await this.prisma.paymentItem.delete({ where: { id: itemId } });
    return this.recalcularTotal(item.paymentId);
  }

  async confirmRemainingPayment(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

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

  async cancelPayment(id: number) {
    return this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  async listPayments(userId?: number) {
    const payments = await this.prisma.payment.findMany({
      where: userId ? { userId } : undefined,
      include: this.paymentListInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return this.mapPaymentsList(payments);
  }

  async filterPayments(filters: ListPaymentsFilters = {}) {
    const { userId, sedeId } = filters;

    const payments = await this.prisma.payment.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(sedeId ? { appointment: { sedeId } } : {}),
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
    const brand = dto.brand ?? this.detectCardBrand(dto.cardNumber);
    const last4 = dto.cardNumber.slice(-4);

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
