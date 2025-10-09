import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  async createPayment(dto: CreatePaymentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: { service: { include: { prices: true } } },
    });

    if (!appointment) throw new BadRequestException('La cita no existe');

    const totalAmount =
      dto.amount ?? appointment.service.prices[0]?.amount ?? 0;

    // Si es pago en establecimiento: 20% del total
    const reservedAmount =
      dto.method === PaymentMethod.CASH ? totalAmount * 0.2 : totalAmount;

    // Crear registro de pago
    const payment = await this.prisma.payment.create({
      data: {
        appointmentId: dto.appointmentId,
        method: dto.method,
        totalAmount,
        reservedAmount,
        paidAmount: 0,
        status: PaymentStatus.PENDING,
      },
    });

    // Procesar según método
    if (dto.method === PaymentMethod.CARD) {
      return this.processCardPayment(payment, dto);
    } else {
      return this.processPartialPayment(payment);
    }
  }

  // 💳 Pago completo con tarjeta
  private async processCardPayment(payment, dto: CreatePaymentDto) {
    const fakeBankAPI = 'https://api.fakebank.com/pay';

    const payload = {
      cardNumber: dto.cardNumber,
      expiryDate: dto.expiryDate,
      cvv: dto.cvv,
      amount: payment.totalAmount,
      currency: 'EUR',
      reference: `APT-${payment.id}`,
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(fakeBankAPI, payload),
      );

      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: data.transactionId ?? `TXN-${payment.id}`,
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

    // Aquí simulas el cobro parcial del 20%
    const fakeReserveAPI = 'https://api.fakebank.com/reserve';
    const payload = {
      amount: reserved,
      reference: `RSV-${payment.id}`,
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(fakeReserveAPI, payload),
      );

      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: data.transactionId ?? `RSV-${payment.id}`,
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

  async listPayments() {
    return this.prisma.payment.findMany({
      include: { appointment: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
