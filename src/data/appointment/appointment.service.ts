import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, ClientState } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  private getMinutesFromDate(date: Date) {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
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
        ['es', 'es-ES', 'es-419'].includes(translation.language.toLowerCase()),
      )?.name ??
      appointment.service?.translations[0]?.name ??
      null;

    return {
      appointmentId: appointment.id,
      serviceId: appointment.serviceId,
      serviceName,
      profesionalId: appointment.profesionalId,
      profesionalNombre: appointment.profesional?.nombre ?? null,
      sedeId: appointment.sedeId,
      sedeNombre: appointment.sede?.nombre ?? null,
      estado: appointment.estado,
      fecha: appointment.fecha.toISOString(),
      horaInicio: appointment.horaInicio.toISOString(),
      horaFin: appointment.horaFin.toISOString(),
    };
  }

  async create(data: CreateAppointmentDto) {
    const fecha = new Date(data.fecha);
    const horaInicio = new Date(data.horaInicio);
    const horaFin = new Date(data.horaFin);

    if ([fecha, horaInicio, horaFin].some((d) => Number.isNaN(d.getTime()))) {
      throw new BadRequestException(
        'Las fechas y horas proporcionadas son inválidas',
      );
    }

    const appointmentDay = fecha.toISOString().slice(0, 10);
    const inicioDia = horaInicio.toISOString().slice(0, 10);
    const finDia = horaFin.toISOString().slice(0, 10);

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

    const [user, profesional, service, relation, sede] = await Promise.all([
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

    if (!user) {
      throw new BadRequestException('El usuario no existe');
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

    const dayOfWeek = horaInicio.getUTCDay();
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
      const normalizedTarget = dayNames[dayOfWeek];

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

    const fitsWithinSchedule = scheduleRanges.some(
      (range) => inicio >= range.start && fin <= range.end,
    );

    if (!fitsWithinSchedule) {
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
      const cierreDia = new Date(cierreParcial.fecha)
        .toISOString()
        .slice(0, 10);
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
        profesionalId: data.profesionalId,
        horaInicio: { lt: horaFin },
        horaFin: { gt: horaInicio },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'El profesional ya tiene una cita en ese horario',
      );
    }

    return this.prisma.appointment.create({
      data: {
        ...appointmentData,
        fecha,
        horaInicio,
        horaFin,
      },
    });
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

  async findAll() {
    return this.prisma.appointment.findMany({
      include: {
        sede: true,
        service: true,
        profesional: true,
        user: true,
      },
      orderBy: { fecha: 'asc' },
    });
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
