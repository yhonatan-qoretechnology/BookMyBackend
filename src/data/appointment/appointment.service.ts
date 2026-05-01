import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, ClientState } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

import { PaymentService } from '../payment/payment.service';

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Madrid';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  private toIsoOrNull(value: unknown) {
    if (!(value instanceof Date)) return null;
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  private isUtcFormat(dateStr: string): boolean {
    return dateStr.endsWith('Z') || dateStr.includes('+');
  }

  private getMinutesFromDate(date: Date) {
    const dateInTimezone = new Date(
      date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
    );
    return dateInTimezone.getHours() * 60 + dateInTimezone.getMinutes();
  }

  private getDayOfWeekInTimezone(date: Date): number {
    const dateInTimezone = new Date(
      date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
    );
    return dateInTimezone.getDay();
  }

  private getDateInTimezone(date: Date): string {
    const dateInTimezone = new Date(
      date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
    );
    return dateInTimezone.toISOString().slice(0, 10);
  }

  private getMinutesFromHourString(hour: string) {
    const [hours, minutes] = hour.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private rangesOverlap(
    startA: number,
    endA: number,
    startB: number,
    endB: number,
  ) {
    return startA < endB && endA > startB;
  }

  private normalizeToDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private normalizeKey(key: string) {
    return key
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  private parseScheduleRanges(entry?: string | null) {
    if (!entry) return [] as { start: number; end: number }[];

    const trimmed = entry.replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed.toLowerCase() === 'cerrado') {
      return [];
    }

    return trimmed.split(' ').map((range) => {
      const [start, end] = range.split('-');
      return {
        start: this.getMinutesFromHourString(start),
        end: this.getMinutesFromHourString(end),
      };
    });
  }

  private buildAppointmentSummary(appointment: {
    id: number;
    serviceId: number;
    profesionalId: number;
    sedeId: number;
    estado: AppointmentStatus;
    fecha: Date;
    horaInicio: Date;
    horaFin: Date;
    service?: {
      translations: { language: string; name: string }[];
    } | null;
    profesional?: { nombre: string } | null;
    sede?: { nombre: string } | null;
  }) {
    const serviceName =
      appointment.service?.translations.find((translation) =>
        ['es', 'es-ES', 'es-419'].includes(
          (translation.language ?? '').toLowerCase(),
        ),
      )?.name ??
      appointment.service?.translations[0]?.name ??
      null;

    const fechaIso = this.toIsoOrNull(appointment.fecha);
    const horaInicioIso = this.toIsoOrNull(appointment.horaInicio);
    const horaFinIso = this.toIsoOrNull(appointment.horaFin);

    if (!fechaIso || !horaInicioIso || !horaFinIso) {
      this.logger.warn(
        `Cita con fechas inválidas o nulas al construir summary: appointmentId=${appointment.id}, fecha=${String(
          appointment.fecha,
        )}, horaInicio=${String(appointment.horaInicio)}, horaFin=${String(
          appointment.horaFin,
        )}`,
      );
    }

    return {
      appointmentId: appointment.id,
      serviceId: appointment.serviceId,
      serviceName,
      profesionalId: appointment.profesionalId,
      profesionalNombre: appointment.profesional?.nombre ?? null,
      sedeId: appointment.sedeId,
      sedeNombre: appointment.sede?.nombre ?? null,
      estado: appointment.estado,
      fecha: fechaIso,
      horaInicio: horaInicioIso,
      horaFin: horaFinIso,
    };
  }

  async handleReservationClient(body: { email: string }) {
    const result = await this.searchClient(body.email);

    if (!result.found) {
      return {
        ...result,
        redirectUrl: '/clients/create',
        actionMessage: `El cliente con email "${body.email}" no está registrado. Debe crearlo primero antes de continuar con la reserva.`,
        requiresClientCreation: true,
      };
    }

    return {
      ...result,
      actionMessage: `Cliente encontrado: ${result.client?.name || result.client?.email}. Puede continuar con la reserva.`,
      requiresClientCreation: false,
    };
  }

  async searchClient(email?: string) {
    if (!email) {
      throw new BadRequestException('Debe proporcionar email para buscar');
    }

    const client = await this.prisma.users.findFirst({
      where: {
        email: email.toLowerCase(),
        role: 'CLIENT',
      },
      include: {
        UserData: true,
        UserLocation: true,
      },
    });

    if (client) {
      return {
        found: true,
        client: {
          id: client.id,
          email: client.email,
          name: client.UserData?.name,
          phone: client.UserData?.phone,
        },
        message: 'Cliente encontrado',
      };
    }

    return {
      found: false,
      message: 'Cliente no encontrado. Por favor, cree un nuevo cliente.',
      suggestedAction: 'CREATE_CLIENT',
      searchParams: { email },
    };
  }

  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }
    return date;
  }

  async create(data: CreateAppointmentDto) {
    const fecha = this.parseDate(data.fecha);
    const horaInicio = this.parseDate(data.horaInicio);
    const horaFin = this.parseDate(data.horaFin);

    if ([fecha, horaInicio, horaFin].some((d) => Number.isNaN(d.getTime()))) {
      throw new BadRequestException(
        'Las fechas y horas proporcionadas son inválidas',
      );
    }

    const debugPayload = {
      userId: data.userId,
      sedeId: data.sedeId,
      serviceId: data.serviceId,
      profesionalId: data.profesionalId,
      duracion: data.duracion,
      fecha: fecha.toISOString(),
      horaInicio: horaInicio.toISOString(),
      horaFin: horaFin.toISOString(),
    };
    this.logger.log(
      `Intento de crear cita con payload: ${JSON.stringify(debugPayload)}`,
    );

    try {
      const appointmentDay = this.getDateInTimezone(fecha);
      const inicioDia = this.getDateInTimezone(horaInicio);
      const finDia = this.getDateInTimezone(horaFin);

      if (appointmentDay !== inicioDia || appointmentDay !== finDia) {
        throw new BadRequestException(
          'La fecha de la cita debe coincidir con las horas de inicio y fin',
        );
      }

      if (horaFin <= horaInicio) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la de inicio',
        );
      }

      const durationMinutes = Math.round(
        (horaFin.getTime() - horaInicio.getTime()) / (1000 * 60),
      );

      if (durationMinutes !== data.duracion) {
        throw new BadRequestException(
          'La duración proporcionada debe coincidir con el intervalo seleccionado',
        );
      }

      const [userDirect, profesional, service, relation, sede] =
        await Promise.all([
          this.prisma.users.findUnique({ where: { id: data.userId } }),
          this.prisma.profesional.findUnique({
            where: { id: data.profesionalId },
          }),
          this.prisma.service.findUnique({
            where: { id: data.serviceId },
            include: { prices: true },
          }),
          this.prisma.serviceSedeProfesional.findFirst({
            where: {
              sedeId: data.sedeId,
              serviceId: data.serviceId,
              profesionalId: data.profesionalId,
            },
          }),
          this.prisma.sede.findUnique({
            where: { id: data.sedeId },
            include: { HorarioSede: true, DiaCerradoSede: true },
          }),
        ]);

      let user = userDirect;
      if (!user) {
        const userData = await this.prisma.userData.findUnique({
          where: { id: data.userId },
          select: { userId: true },
        });

        if (userData?.userId) {
          user = await this.prisma.users.findUnique({
            where: { id: userData.userId },
          });
        }
      }

      if (!user) {
        throw new BadRequestException('El usuario no existe');
      }

      if (user.state !== 'enabled') {
        throw new BadRequestException(
          'Cuenta no activa: tu usuario no está activo. Revisa tu correo para completar la activación o solicita un nuevo código.',
        );
      }

      if (!profesional) {
        throw new BadRequestException('El profesional no existe');
      }

      if (profesional.state !== ClientState.enabled) {
        throw new BadRequestException(
          'El profesional no está disponible para agendar citas',
        );
      }

      if (!service) {
        throw new BadRequestException('El servicio seleccionado no existe');
      }

      if (!relation) {
        throw new BadRequestException(
          'El profesional no está asociado a ese servicio en la sede seleccionada',
        );
      }

      if (!sede) {
        throw new BadRequestException('La sede seleccionada no existe');
      }

      const matchingPrice = service.prices.find(
        (price) => price.duration === data.duracion,
      );
      if (!matchingPrice) {
        throw new BadRequestException(
          'La duración no coincide con ninguna tarifa registrada para el servicio',
        );
      }

      const {
        paymentMethod,
        paymentAmount,
        cardNumber,
        expiryDate,
        cvv,
        ...appointmentData
      } = data;

      const dayOfWeek = this.getDayOfWeekInTimezone(horaInicio);
      const dayNames = [
        'domingo',
        'lunes',
        'martes',
        'miércoles',
        'jueves',
        'viernes',
        'sábado',
      ];
      const horaEnTimezone = new Date(
        horaInicio.toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
      );
      this.logger.log(
        `Debug horario: horaInicio=${horaInicio.toISOString()}, getHours()=${horaEnTimezone.getHours()}, getDay()=${dayOfWeek} (${dayNames[dayOfWeek]}), getMinutes()=${horaEnTimezone.getMinutes()}, isUtc=${this.isUtcFormat(data.horaInicio)}`,
      );
      const horarioRegistro = sede.HorarioSede.find(
        (registro) => registro.diaSemana === dayOfWeek && registro.activo,
      );

      let scheduleRanges: { start: number; end: number }[] = [];

      if (horarioRegistro) {
        scheduleRanges = [
          {
            start: this.getMinutesFromHourString(horarioRegistro.horaApertura),
            end: this.getMinutesFromHourString(horarioRegistro.horaCierre),
          },
        ];
      } else if (sede.horario && typeof sede.horario === 'object') {
        const dayNames = [
          'domingo',
          'lunes',
          'martes',
          'miércoles',
          'jueves',
          'viernes',
          'sábado',
        ];
        const normalizedTarget = this.normalizeKey(dayNames[dayOfWeek]);

        const entry = Object.entries(
          sede.horario as Record<string, string | null>,
        ).find(([key]) => this.normalizeKey(key) === normalizedTarget)?.[1];

        scheduleRanges = this.parseScheduleRanges(entry ?? undefined);
      }

      if (!scheduleRanges.length) {
        this.logger.warn(
          `Sede sin horario activo para la fecha solicitada: sedeId=${sede.id}, diaSemana=${dayOfWeek}, fecha=${horaInicio.toISOString()}, horariosConfigurados=${JSON.stringify(
            sede.HorarioSede.map((registro) => ({
              diaSemana: registro.diaSemana,
              activo: registro.activo,
              apertura: registro.horaApertura,
              cierre: registro.horaCierre,
            })),
          )}`,
        );
        throw new BadRequestException(
          'La sede está cerrada el día seleccionado',
        );
      }

      const inicio = this.getMinutesFromDate(horaInicio);
      const fin = this.getMinutesFromDate(horaFin);

      const fitsWithinSchedule = scheduleRanges.some((range) => {
        const rangeLength = range.end - range.start;
        if (durationMinutes > rangeLength) {
          this.logger.warn(
            `Duración ${durationMinutes} min excede rango disponible (${rangeLength} min) para sedeId=${sede.id}, rango=${JSON.stringify(
              range,
            )}`,
          );
          return false;
        }

        const adjustedEnd = range.end + durationMinutes;
        return (
          inicio >= range.start && inicio <= range.end && fin <= adjustedEnd
        );
      });

      if (!fitsWithinSchedule) {
        this.logger.warn(
          `Horario fuera de rango para cita: inicio=${horaInicio.toISOString()} (${inicio} min), fin=${horaFin.toISOString()} (${fin} min), rangos=${JSON.stringify(
            scheduleRanges,
          )}, sedeId=${sede.id}`,
        );
        throw new BadRequestException(
          'La cita se encuentra fuera del horario operativo de la sede',
        );
      }

      const diasCerradosRegistros = sede.DiaCerradoSede.length
        ? sede.DiaCerradoSede
        : Array.isArray(sede.diasCerrado)
          ? (sede.diasCerrado as string[]).map((dateStr) => ({
              fecha: new Date(`${dateStr}T00:00:00Z`),
              todoElDia: true,
              horaInicio: null,
              horaFin: null,
            }))
          : [];

      for (const cierreParcial of diasCerradosRegistros) {
        if (!cierreParcial.fecha) continue;
        const cierreFecha = new Date(cierreParcial.fecha);
        if (Number.isNaN(cierreFecha.getTime())) continue;
        const cierreDia = this.getDateInTimezone(cierreFecha);
        if (cierreDia !== appointmentDay) continue;

        if (cierreParcial.todoElDia ?? true) {
          throw new BadRequestException(
            'La sede está cerrada durante todo el día seleccionado',
          );
        }

        if (cierreParcial.horaInicio && cierreParcial.horaFin) {
          const cierreInicio = this.getMinutesFromHourString(
            cierreParcial.horaInicio,
          );
          const cierreFin = this.getMinutesFromHourString(
            cierreParcial.horaFin,
          );
          if (this.rangesOverlap(inicio, fin, cierreInicio, cierreFin)) {
            this.logger.warn(
              `Cita solapada con cierre parcial: inicio=${horaInicio.toISOString()} (${inicio} min), fin=${horaFin.toISOString()} (${fin} min), cierreInicio=${cierreParcial.horaInicio}, cierreFin=${cierreParcial.horaFin}, sedeId=${sede.id}`,
            );
            throw new BadRequestException(
              'La cita se solapa con un cierre parcial de la sede',
            );
          }
        }
      }

      const disponibilidad =
        await this.prisma.disponibilidadProfesional.findUnique({
          where: {
            profesionalId_fecha: {
              profesionalId: data.profesionalId,
              fecha: this.normalizeToDay(fecha),
            },
          },
        });

      if (disponibilidad) {
        if (!disponibilidad.disponible) {
          throw new BadRequestException(
            'El profesional no está disponible ese día',
          );
        }

        if (disponibilidad.horaInicio && disponibilidad.horaFin) {
          const dispoInicio = this.getMinutesFromHourString(
            disponibilidad.horaInicio,
          );
          const dispoFin = this.getMinutesFromHourString(
            disponibilidad.horaFin,
          );

          if (inicio < dispoInicio || fin > dispoFin) {
            throw new BadRequestException(
              'La cita se encuentra fuera del rango disponible del profesional',
            );
          }
        }
      }

      const overlapping = await this.prisma.appointment.findFirst({
        where: {
          profesionalId: data.profesionalId,
          fecha: fecha,
          horaInicio: { lt: horaFin },
          horaFin: { gt: horaInicio },
        },
      });

      if (overlapping) {
        throw new BadRequestException(
          'El profesional ya tiene una cita en ese horario',
        );
      }

      const appointment = await this.prisma.appointment.create({
        data: {
          ...appointmentData,
          fecha,
          horaInicio,
          horaFin,
        },
      });

      this.logger.log(
        `Cita creada: id=${appointment.id}, sedeId=${appointment.sedeId}, profesionalId=${appointment.profesionalId}, userId=${appointment.userId}, inicio=${appointment.horaInicio.toISOString()}, fin=${appointment.horaFin.toISOString()}`,
      );

      // Crear el registro de pago asociado
      let expiryMonth: number | undefined;
      let expiryYear: number | undefined;

      if (data.expiryDate) {
        const [month, year] = data.expiryDate.split('/').map(Number);
        expiryMonth = month;
        expiryYear = 2000 + year; // Asumiendo formato YY
      }

      await this.paymentService.createPayment({
        userId: data.userId,
        appointmentId: appointment.id,
        method: data.paymentMethod,
        amount: data.paymentAmount,
        cardNumber: data.cardNumber,
        expiryMonth,
        expiryYear,
        cvv: data.cvv,
        saveCard: false, // Por defecto no guardar a menos que se extienda el DTO
      });

      return appointment;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);

      // Detectar errores de Prisma y traducirlos a 400/409
      if (error instanceof Error) {
        const prismaErrorMessage = error.message.toLowerCase();

        // Unique constraint failed (conflicto de horario)
        if (
          prismaErrorMessage.includes('unique constraint') ||
          prismaErrorMessage.includes('unique constraint failed')
        ) {
          throw new BadRequestException(
            'El profesional ya tiene una cita programada en ese horario',
          );
        }

        // Foreign key constraint failed (relaciones inexistentes)
        if (
          prismaErrorMessage.includes('foreign key constraint') ||
          prismaErrorMessage.includes('invalid reference')
        ) {
          throw new BadRequestException(
            'Datos inválidos: el profesional, servicio o sede no existen',
          );
        }

        // Not found o constraint violation
        if (
          prismaErrorMessage.includes('record to update not found') ||
          prismaErrorMessage.includes('record not found')
        ) {
          throw new BadRequestException(
            'No se pudo crear la cita: datos inválidos',
          );
        }
      }

      // Si ya es BadRequestException o similar, propagar tal cual
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Para cualquier otro error, loguear y lanzar 500 con detalle interno
      this.logger.error(
        `Error al crear cita con payload ${JSON.stringify(debugPayload)}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(errorMessage);
    }
  }

  async getUserServices(userId: number) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const [pendingAppointments, completedAppointments] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          userId,
          estado: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
        },
        orderBy: { fecha: 'asc' },
        include: {
          service: {
            select: {
              translations: { select: { language: true, name: true } },
            },
          },
          profesional: { select: { nombre: true } },
          sede: { select: { nombre: true } },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          userId,
          estado: AppointmentStatus.COMPLETED,
        },
        orderBy: { fecha: 'desc' },
        include: {
          service: {
            select: {
              translations: { select: { language: true, name: true } },
            },
          },
          profesional: { select: { nombre: true } },
          sede: { select: { nombre: true } },
        },
      }),
    ]);

    return {
      pending: pendingAppointments.map((appointment) =>
        this.buildAppointmentSummary(appointment),
      ),
      completed: completedAppointments.map((appointment) =>
        this.buildAppointmentSummary(appointment),
      ),
    };
  }

  async findAll(params?: { sedeId?: number; page?: number; limit?: number }) {
    const sedeId = params?.sedeId;
    const page = params?.page && params.page > 0 ? params.page : 1;
    const limit = params?.limit && params.limit > 0 ? params.limit : 50;
    const skip = (page - 1) * limit;

    const where = sedeId ? { sedeId } : undefined;

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          sede: true,
          service: true,
          profesional: true,
          user: true,
        },
        orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async filterAppointments(params: {
    sedeId?: number;
    date?: string;
    serviceId?: number;
    hour?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 50;
    const skip = (page - 1) * limit;

    const and: any[] = [];

    if (params.sedeId) and.push({ sedeId: params.sedeId });
    if (params.serviceId) and.push({ serviceId: params.serviceId });

    let dayStart: Date | undefined;
    let dayEnd: Date | undefined;

    if (params.date) {
      const parsed = new Date(`${params.date}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
      }

      dayStart = parsed;
      dayEnd = new Date(parsed);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      // Algunas integraciones guardan el “día” en `fecha` y otras se basan en `horaInicio`.
      // Para no perder resultados, aplicamos el rango del día sobre ambos campos.
      and.push({
        OR: [
          { fecha: { gte: dayStart, lt: dayEnd } },
          { horaInicio: { gte: dayStart, lt: dayEnd } },
        ],
      });
    }

    if (params.hour && params.date) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(params.hour);
      if (!match) {
        throw new BadRequestException('La hora debe tener formato HH:mm');
      }
      const hour = Number(match[1]);
      const minute = Number(match[2]);

      const base = new Date(`${params.date}T00:00:00.000Z`);
      const start = new Date(base);
      start.setUTCHours(hour, minute, 0, 0);
      const end = new Date(start);
      end.setUTCMinutes(end.getUTCMinutes() + 1);

      and.push({ horaInicio: { gte: start, lt: end } });
    }

    const where = and.length ? { AND: and } : undefined;

    const runQuery = async (whereInput: any) => {
      const [items, total] = await Promise.all([
        this.prisma.appointment.findMany({
          where: whereInput,
          include: {
            sede: true,
            service: true,
            profesional: true,
            user: true,
          },
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
          skip,
          take: limit,
        }),
        this.prisma.appointment.count({ where: whereInput }),
      ]);

      return { items, total };
    };

    let fallbackApplied = false;
    let { items, total } = await runQuery(where);

    if (!items.length) {
      const now = new Date();
      const startOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const startOfNextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      );

      const fallbackAnd: any[] = [];
      if (params.sedeId) fallbackAnd.push({ sedeId: params.sedeId });
      if (params.serviceId) fallbackAnd.push({ serviceId: params.serviceId });

      fallbackAnd.push({
        OR: [
          { fecha: { gte: startOfMonth, lt: startOfNextMonth } },
          { horaInicio: { gte: startOfMonth, lt: startOfNextMonth } },
        ],
      });

      const fallbackWhere = { AND: fallbackAnd };
      const fallbackResult = await runQuery(fallbackWhere);
      items = fallbackResult.items;
      total = fallbackResult.total;
      fallbackApplied = true;
    }

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      fallbackApplied,
    };
  }

  async getLatestBySede(
    sedeId: number,
    options?: { limit?: number; month?: number; year?: number },
  ) {
    const limit = options?.limit ?? 10;
    const month = options?.month;
    const year = options?.year;
    const effectiveYear = year ?? new Date().getFullYear();

    if (month !== undefined && (month < 1 || month > 12)) {
      throw new BadRequestException('El mes debe estar entre 1 y 12');
    }

    const startDate = month
      ? new Date(Date.UTC(effectiveYear, month - 1, 1))
      : new Date(Date.UTC(effectiveYear, 0, 1));
    const endDate = month
      ? new Date(Date.UTC(effectiveYear, month, 1))
      : new Date(Date.UTC(effectiveYear + 1, 0, 1));

    return this.prisma.appointment.findMany({
      where: {
        sedeId,
        fecha: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        sede: true,
        service: true,
        profesional: true,
        user: true,
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
      take: limit,
    });
  }

  async getCalendar(options: {
    sedeId: number;
    fechaInicio?: string;
    fechaFin?: string;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate = options.fechaInicio
      ? new Date(`${options.fechaInicio}T00:00:00.000Z`)
      : today;
    let endDate = options.fechaFin
      ? new Date(`${options.fechaFin}T23:59:59.999Z`)
      : new Date(
          Date.UTC(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        );

    const appointments = await this.prisma.appointment.findMany({
      where: {
        sedeId: options.sedeId,
        fecha: { gte: startDate, lte: endDate },
      },
      include: {
        sede: true,
        service: { include: { translations: true, prices: true } },
        profesional: true,
        user: { include: { UserData: true } },
        Payment: true,
      },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    return appointments.map((apt) => ({
      id: apt.id,
      fecha: apt.fecha,
      horaInicio: apt.horaInicio,
      horaFin: apt.horaFin,
      estado: apt.estado,
      duracion: apt.duracion,
      notas: apt.notas,
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,
      sede: {
        id: apt.sede.id,
        nombre: apt.sede.nombre,
        direccion: apt.sede.direccion,
        telefono: apt.sede.telefono,
      },
      service: {
        id: apt.service.id,
        nombre: apt.service.translations?.[0]?.name ?? 'Sin nombre',
        descripcion: apt.service.translations?.[0]?.description ?? '',
        precios: apt.service.prices,
      },
      profesional: {
        id: apt.profesional.id,
        nombre: apt.profesional.nombre,
        telefono: apt.profesional.phone,
      },
      user: {
        id: apt.user.id,
        email: apt.user.email,
        nombre: apt.user.UserData?.name ?? '',
        telefono: apt.user.UserData?.phone ?? '',
      },
      payment: apt.Payment
        ? {
            id: apt.Payment.id,
            method: apt.Payment.method,
            totalAmount: apt.Payment.totalAmount,
            paidAmount: apt.Payment.paidAmount,
            status: apt.Payment.status,
          }
        : null,
    }));
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        sede: true,
        service: true,
        profesional: true,
        user: true,
      },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    return appointment;
  }

  async update(id: number, data: UpdateAppointmentDto) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        fecha: data.fecha ? new Date(data.fecha) : cita.fecha,
        horaInicio: data.horaInicio
          ? new Date(data.horaInicio)
          : cita.horaInicio,
        horaFin: data.horaFin ? new Date(data.horaFin) : cita.horaFin,
      },
    });
  }

  async reschedule(
    id: number,
    data: {
      fecha: string;
      horaInicio: string;
      horaFin?: string;
      motivo?: string;
    },
  ) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    const oldFecha = cita.fecha.toISOString().split('T')[0];
    const oldHoraInicio = cita.horaInicio
      .toISOString()
      .split('T')[1]
      .slice(0, 8);

    const fechaParts = data.fecha.split('-');
    const año = parseInt(fechaParts[0]);
    const mes = parseInt(fechaParts[1]) - 1;
    const dia = parseInt(fechaParts[2]);

    const horaInicioParts = data.horaInicio.split(':');
    const horaInicio = new Date(
      Date.UTC(
        año,
        mes,
        dia,
        parseInt(horaInicioParts[0]),
        parseInt(horaInicioParts[1]),
        parseInt(horaInicioParts[2]),
      ),
    );

    const now = new Date();
    if (horaInicio < now) {
      throw new BadRequestException(
        'No se puede agendar en una fecha u hora anterior a la actual',
      );
    }

    let horaFin: Date;
    if (data.horaFin) {
      const horaFinParts = data.horaFin.split(':');
      horaFin = new Date(
        Date.UTC(
          año,
          mes,
          dia,
          parseInt(horaFinParts[0]),
          parseInt(horaFinParts[1]),
          parseInt(horaFinParts[2]),
        ),
      );
    } else {
      const duracionMinutos =
        (cita.horaFin.getTime() - cita.horaInicio.getTime()) / (1000 * 60);
      horaFin = new Date(horaInicio.getTime() + duracionMinutos * 60 * 1000);
    }

    if (horaFin <= horaInicio) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio',
      );
    }

    const durationMinutes = Math.round(
      (horaFin.getTime() - horaInicio.getTime()) / (1000 * 60),
    );
    if (durationMinutes !== cita.duracion) {
      throw new BadRequestException(
        'La duración debe coincidir con la cita original: ' +
          cita.duracion +
          ' minutos',
      );
    }

    const [profesional, sede] = await Promise.all([
      this.prisma.profesional.findUnique({ where: { id: cita.profesionalId } }),
      this.prisma.sede.findUnique({
        where: { id: cita.sedeId },
        include: { HorarioSede: true, DiaCerradoSede: true },
      }),
    ]);

    if (!profesional) throw new BadRequestException('El profesional no existe');
    if (profesional.state !== ClientState.enabled)
      throw new BadRequestException('El profesional no está disponible');

    if (!sede) throw new BadRequestException('La sede no existe');

    const fecha = new Date(Date.UTC(año, mes, dia));
    const dayOfWeek = this.getDayOfWeekInTimezone(horaInicio);
    const dayNames = [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ];
    const horaEnTimezone = new Date(
      horaInicio.toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
    );

    const horarioRegistro = sede.HorarioSede.find(
      (r) => r.diaSemana === dayOfWeek && r.activo,
    );
    let scheduleRanges: { start: number; end: number }[] = [];

    if (horarioRegistro) {
      scheduleRanges = [
        {
          start: this.getMinutesFromHourString(horarioRegistro.horaApertura),
          end: this.getMinutesFromHourString(horarioRegistro.horaCierre),
        },
      ];
    } else if (sede.horario && typeof sede.horario === 'object') {
      const normalizedTarget = this.normalizeKey(dayNames[dayOfWeek]);
      const entry = Object.entries(
        sede.horario as Record<string, string | null>,
      ).find(([key]) => this.normalizeKey(key) === normalizedTarget)?.[1];
      scheduleRanges = this.parseScheduleRanges(entry ?? undefined);
    }

    if (!scheduleRanges.length) {
      throw new BadRequestException('La sede está cerrada el día seleccionado');
    }

    const inicio = this.getMinutesFromDate(horaInicio);
    const fin = this.getMinutesFromDate(horaFin);

    const fitsWithinSchedule = scheduleRanges.some((range) => {
      const rangeLength = range.end - range.start;
      if (durationMinutes > rangeLength) return false;
      const adjustedEnd = range.end + durationMinutes;
      return inicio >= range.start && inicio <= range.end && fin <= adjustedEnd;
    });

    if (!fitsWithinSchedule) {
      throw new BadRequestException(
        'La cita se encuentra fuera del horario operativo de la sede',
      );
    }

    const appointmentDay = this.getDateInTimezone(fecha);
    const diasCerradosRegistros = sede.DiaCerradoSede.length
      ? sede.DiaCerradoSede
      : Array.isArray(sede.diasCerrado)
        ? (sede.diasCerrado as string[]).map((d) => ({
            fecha: new Date(`${d}T00:00:00Z`),
            todoElDia: true,
            horaInicio: null,
            horaFin: null,
          }))
        : [];

    for (const cierreParcial of diasCerradosRegistros) {
      if (!cierreParcial.fecha) continue;
      const cierreFecha = new Date(cierreParcial.fecha);
      if (Number.isNaN(cierreFecha.getTime())) continue;
      const cierreDia = this.getDateInTimezone(cierreFecha);
      if (cierreDia !== appointmentDay) continue;

      if (cierreParcial.todoElDia ?? true) {
        throw new BadRequestException(
          'La sede está cerrada durante todo el día seleccionado',
        );
      }

      if (cierreParcial.horaInicio && cierreParcial.horaFin) {
        const cierreInicio = this.getMinutesFromHourString(
          cierreParcial.horaInicio,
        );
        const cierreFin = this.getMinutesFromHourString(cierreParcial.horaFin);
        if (this.rangesOverlap(inicio, fin, cierreInicio, cierreFin)) {
          throw new BadRequestException(
            'La cita se solapa con un cierre parcial de la sede',
          );
        }
      }
    }

    const disponibilidad =
      await this.prisma.disponibilidadProfesional.findUnique({
        where: {
          profesionalId_fecha: {
            profesionalId: cita.profesionalId,
            fecha: this.normalizeToDay(fecha),
          },
        },
      });

    if (disponibilidad) {
      if (!disponibilidad.disponible)
        throw new BadRequestException(
          'El profesional no está disponible ese día',
        );
      if (disponibilidad.horaInicio && disponibilidad.horaFin) {
        const dispoInicio = this.getMinutesFromHourString(
          disponibilidad.horaInicio,
        );
        const dispoFin = this.getMinutesFromHourString(disponibilidad.horaFin);
        if (inicio < dispoInicio || fin > dispoFin) {
          throw new BadRequestException(
            'La cita se encuentra fuera del rango disponible del profesional',
          );
        }
      }
    }

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        id: { not: id },
        profesionalId: cita.profesionalId,
        fecha: fecha,
        horaInicio: { lt: horaFin },
        horaFin: { gt: horaInicio },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'El profesional ya tiene una cita en ese horario',
      );
    }

    const motivo = data.motivo
      ? `Reagendado: ${data.motivo}`
      : `Reagendado el ${new Date().toISOString()}. Fecha anterior: ${oldFecha} ${oldHoraInicio}`;

    return this.prisma.appointment.update({
      where: { id },
      data: {
        fecha,
        horaInicio,
        horaFin,
        notas: motivo,
      },
    });
  }

  async cancel(id: number, motivo = 'Cancelado por el usuario') {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        estado: AppointmentStatus.CANCELLED,
        notas: motivo,
      },
    });
  }

  async remove(id: number) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    return this.prisma.appointment.delete({ where: { id } });
  }
}
