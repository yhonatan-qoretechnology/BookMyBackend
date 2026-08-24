import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

export interface NewReservationNotificationInput {
  appointmentId: number;
  sedeId: number;
  sedeNombre: string;
  serviceId: number;
  serviceNombre: string;
  profesionalId: number;
  profesionalNombre: string;
  clienteNombre: string;
  fecha: Date;
  horaInicio: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
  ) {}

  private async create(
    userId: number,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // Push en tiempo real si el destinatario está conectado. Si no lo
    // está, igual queda persistida y la va a ver la próxima vez que
    // consulte /notifications.
    this.gateway.emitToUser(userId, notification);

    return notification;
  }

  /**
   * Notifica al/los BRANCH_ADMIN de la sede donde se hizo una reserva.
   * Best-effort: si algo falla acá, nunca debe tumbar la creación de la
   * cita (el llamador debe atrapar el error, no dejar que se propague).
   */
  async notifyNewReservation(
    input: NewReservationNotificationInput,
  ): Promise<void> {
    const admins = await this.prisma.adminProfile.findMany({
      where: { sedeId: input.sedeId },
      select: { userId: true },
    });

    if (admins.length === 0) {
      this.logger.warn(
        `No hay BRANCH_ADMIN configurado para sedeId=${input.sedeId}; no se notifica a nadie de la reserva ${input.appointmentId}.`,
      );
      return;
    }

    const horaLabel = input.horaInicio.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    });
    const fechaLabel = input.fecha.toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid',
    });
    const sedeNombre = input.sedeNombre.trim();

    const title = 'Nueva reserva';
    const body = `${input.clienteNombre} reservó ${input.serviceNombre} con ${input.profesionalNombre} el ${fechaLabel} a las ${horaLabel} en ${sedeNombre}.`;

    await Promise.all(
      admins.map((admin) =>
        this.create(admin.userId, 'NEW_RESERVATION', title, body, {
          appointmentId: input.appointmentId,
          sedeId: input.sedeId,
          serviceId: input.serviceId,
          profesionalId: input.profesionalId,
        }),
      ),
    );
  }

  async findForUser(
    userId: number,
    params: { onlyUnread?: boolean; page?: number; limit?: number },
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const where = {
      userId,
      ...(params.onlyUnread ? { read: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return {
      items,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async countUnread(userId: number): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markAsRead(id: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notificación no encontrada.');
    }
    if (notification.read) return notification;

    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number): Promise<{ actualizadas: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { actualizadas: result.count };
  }
}
