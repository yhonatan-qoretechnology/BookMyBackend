import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentHistoryAction,
  AppointmentStatus,
  ClientState,
  DiaCerradoSede,
  HorarioSede,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Profesional,
  Role,
  Sede,
  Service,
  Users,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ExtendAppointmentDto } from './dto/extend-appointment.dto';
import { ReassignAppointmentDto } from './dto/reassign-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ObservacionEsperaDto } from './dto/observacion-espera.dto';

import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Madrid';
const SAME_DAY_SUGGESTION_STEP_MINUTES = 15;

type SedeConHorarios = Sede & {
  HorarioSede: HorarioSede[];
  DiaCerradoSede: DiaCerradoSede[];
};

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
    private accessControlService: AccessControlService,
  ) {}

  /**
   * Best-effort: arma y dispara la notificación al BRANCH_ADMIN de la sede.
   * Nunca debe lanzar hacia arriba (el llamador ya la envuelve en catch,
   * pero se protege doble acá también).
   */
  private async notifyReservationAdmins(
    appointment: { id: number; fecha: Date; horaInicio: Date },
    sede: Sede,
    service: Service,
    profesional: Profesional,
    cliente: Users,
  ): Promise<void> {
    try {
      const serviceTranslation = await this.prisma.serviceTranslation.findFirst({
        where: { serviceId: service.id, language: 'es' },
        select: { name: true },
      });

      const clienteData = await this.prisma.userData.findUnique({
        where: { userId: cliente.id },
        select: { name: true },
      });

      await this.notificationService.notifyNewReservation({
        appointmentId: appointment.id,
        sedeId: sede.id,
        sedeNombre: sede.nombre,
        serviceId: service.id,
        serviceNombre: serviceTranslation?.name ?? 'un servicio',
        profesionalId: profesional.id,
        profesionalNombre: profesional.nombre,
        clienteNombre: clienteData?.name ?? cliente.email,
        fecha: appointment.fecha,
        horaInicio: appointment.horaInicio,
      });
    } catch (error) {
      this.logger.error(
        `Error armando la notificación de la reserva ${appointment.id}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

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
    duracion?: number;
    notas?: string | null;
    service?: {
      translations: { language: string; name: string }[];
    } | null;
    profesional?: {
      id: number;
      nombre: string;
      phone: string | null;
      imagen: string | null;
    } | null;
    sede?: {
      id: number;
      nombre: string;
      direccion: string | null;
      telefono: string | null;
      imagenes: string[] | null;
    } | null;
    user?: {
      id: number;
      email: string;
      UserData?: { name?: string | null; phone?: string | null } | null;
    } | null;
    Payment?: {
      id: number;
      method: string | null;
      totalAmount: number | null;
      paidAmount: number | null;
      status: string | null;
    } | null;
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

    const userName = appointment.user?.UserData?.name ?? null;
    const userPhone = appointment.user?.UserData?.phone ?? null;

    return {
      appointmentId: appointment.id,
      serviceId: appointment.serviceId,
      serviceName,
      profesionalId: appointment.profesionalId,
      profesionalNombre: appointment.profesional?.nombre ?? null,
      profesionalTelefono: appointment.profesional?.phone ?? null,
      profesionalImagen: appointment.profesional?.imagen ?? null,
      sedeId: appointment.sedeId,
      sedeNombre: appointment.sede?.nombre ?? null,
      sedeDireccion: appointment.sede?.direccion ?? null,
      sedeTelefono: appointment.sede?.telefono ?? null,
      sedeImagenes: appointment.sede?.imagenes ?? null,
      userId: appointment.user?.id ?? null,
      userEmail: appointment.user?.email ?? null,
      userNombre: userName,
      userTelefono: userPhone,
      estado: appointment.estado,
      fecha: fechaIso,
      horaInicio: horaInicioIso,
      horaFin: horaFinIso,
      duracion: appointment.duracion ?? null,
      notas: appointment.notas ?? null,
      payment: appointment.Payment
        ? {
            id: appointment.Payment.id,
            method: appointment.Payment.method,
            totalAmount: appointment.Payment.totalAmount,
            paidAmount: appointment.Payment.paidAmount,
            status: appointment.Payment.status,
          }
        : null,
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

  /**
   * Registro de auditoría best-effort: nunca debe tumbar la operación que
   * la disparó (extender, reasignar, reprogramar, cancelar una cita).
   */
  private async logAppointmentHistory(
    appointmentId: number,
    action: AppointmentHistoryAction,
    previousData: Record<string, unknown> | null,
    newData: Record<string, unknown> | null,
    performedByUserId?: number,
    reason?: string,
  ): Promise<void> {
    try {
      await this.prisma.appointmentHistory.create({
        data: {
          appointmentId,
          action,
          previousData: (previousData ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          newData: (newData ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          performedByUserId: performedByUserId ?? undefined,
          reason,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el historial de la cita ${appointmentId} (${action}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  /**
   * Solo el profesional dueño de la cita, un admin con alcance sobre esa
   * sede/empresa, o un SUPER_ADMIN pueden extender o reasignar una cita.
   * A propósito NO se aplica este chequeo a cancel()/reschedule(), que ya
   * existían antes y son usados también por el cliente dueño de la
   * reserva desde la app móvil — agregar esta restricción ahí rompería
   * ese flujo existente.
   */
  private async ensureCanManageAppointment(
    cita: { profesionalId: number; sedeId: number },
    user?: AuthenticatedUser,
  ): Promise<void> {
    if (!user) return;
    if (user.role === Role.SUPER_ADMIN) return;

    if (user.role === Role.EMPLOYEE) {
      if (user.profesionalId !== cita.profesionalId) {
        throw new ForbiddenException(
          'No puede gestionar citas de otro profesional.',
        );
      }
      return;
    }

    if (user.role === Role.COMPANY_ADMIN || user.role === Role.BRANCH_ADMIN) {
      await this.accessControlService.ensureSedeAccessForUser(
        cita.sedeId,
        user,
      );
      return;
    }

    throw new ForbiddenException('No tiene permisos para gestionar esta cita.');
  }

  /**
   * Best-effort: avisa al cliente cuando SU cita cambia por una acción de
   * otra persona (reasignación, reprogramación, cancelación).
   */
  private async notifyClientAboutChange(
    cita: {
      id: number;
      serviceId: number;
      sedeId: number;
      profesionalId: number;
      userId: number;
      fecha: Date;
      horaInicio: Date;
    },
    changeType: 'REASSIGNED' | 'RESCHEDULED' | 'CANCELLED',
  ): Promise<void> {
    try {
      const [service, sede, profesional, cliente] = await Promise.all([
        this.prisma.service.findUnique({
          where: { id: cita.serviceId },
          include: { translations: { where: { language: 'es' }, take: 1 } },
        }),
        this.prisma.sede.findUnique({ where: { id: cita.sedeId } }),
        this.prisma.profesional.findUnique({
          where: { id: cita.profesionalId },
        }),
        this.prisma.users.findUnique({ where: { id: cita.userId } }),
      ]);

      if (!service || !sede || !cliente) return;

      await this.notificationService.notifyAppointmentChanged({
        appointmentId: cita.id,
        clienteUserId: cliente.id,
        changeType,
        serviceNombre: service.translations[0]?.name ?? 'tu servicio',
        sedeNombre: sede.nombre,
        fecha: cita.fecha,
        horaInicio: cita.horaInicio,
        profesionalNombre: profesional?.nombre,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar el cambio (${changeType}) de la cita ${cita.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  /**
   * Especialistas que ofrecen el mismo servicio en la misma sede (excepto
   * el actual) y que están libres en el rango exacto solicitado — para la
   * opción "reasignar" cuando extender una cita choca con la siguiente.
   */
  private async findFreeProfesionalesForSlot(
    sedeId: number,
    serviceId: number,
    excludeProfesionalId: number,
    horaInicio: Date,
    horaFin: Date,
  ): Promise<
    { id: number; nombre: string; phone: string | null; imagen: string | null }[]
  > {
    const candidatos = await this.prisma.serviceSedeProfesional.findMany({
      where: {
        sedeId,
        serviceId,
        profesionalId: { not: excludeProfesionalId },
      },
      include: { profesional: true },
    });

    const libres: {
      id: number;
      nombre: string;
      phone: string | null;
      imagen: string | null;
    }[] = [];

    for (const candidato of candidatos) {
      const profesional = candidato.profesional;
      if (!profesional || profesional.state !== ClientState.enabled) continue;
      // Ya se pudo repetir el mismo profesional en más de una fila (varias
      // sedes/servicios); no lo proceses dos veces.
      if (libres.some((p) => p.id === profesional.id)) continue;

      const ocupado = await this.prisma.appointment.findFirst({
        where: {
          profesionalId: profesional.id,
          estado: { not: AppointmentStatus.CANCELLED },
          horaInicio: { lt: horaFin },
          horaFin: { gt: horaInicio },
        },
      });

      if (!ocupado) {
        libres.push({
          id: profesional.id,
          nombre: profesional.nombre,
          phone: profesional.phone,
          imagen: profesional.imagen,
        });
      }
    }

    return libres;
  }

  /**
   * Huecos libres del mismo profesional, más tarde ese mismo día, con la
   * misma duración que la cita en conflicto — para la opción "reprogramar".
   * Reusa exactamente la misma lógica de horario/cierres/disponibilidad
   * que ya usan create()/reschedule(), pero como enumeración de huecos en
   * vez de validación de un horario puntual.
   */
  private async findSameDayFreeSlots(
    profesionalId: number,
    sede: SedeConHorarios,
    fecha: Date,
    durationMinutes: number,
    notBeforeMinutes: number,
    maxSuggestions = 3,
  ): Promise<{ horaInicio: string; horaFin: string }[]> {
    const dayOfWeek = this.getDayOfWeekInTimezone(fecha);
    const dayNames = [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ];

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

    if (!scheduleRanges.length) return [];

    const appointmentDay = this.getDateInTimezone(fecha);
    const diasCerradosRegistros = sede.DiaCerradoSede.length
      ? sede.DiaCerradoSede
      : Array.isArray(sede.diasCerrado)
        ? (sede.diasCerrado as string[]).map((d) => ({
            fecha: new Date(`${d}T00:00:00Z`),
            todoElDia: true,
            horaInicio: null as string | null,
            horaFin: null as string | null,
          }))
        : [];

    const cierresParciales: { start: number; end: number }[] = [];
    for (const cierre of diasCerradosRegistros) {
      if (!cierre.fecha) continue;
      const cierreFecha = new Date(cierre.fecha);
      if (Number.isNaN(cierreFecha.getTime())) continue;
      if (this.getDateInTimezone(cierreFecha) !== appointmentDay) continue;
      if (cierre.todoElDia ?? true) return [];
      if (cierre.horaInicio && cierre.horaFin) {
        cierresParciales.push({
          start: this.getMinutesFromHourString(cierre.horaInicio),
          end: this.getMinutesFromHourString(cierre.horaFin),
        });
      }
    }

    const disponibilidad =
      await this.prisma.disponibilidadProfesional.findUnique({
        where: {
          profesionalId_fecha: {
            profesionalId,
            fecha: this.normalizeToDay(fecha),
          },
        },
      });

    if (disponibilidad && !disponibilidad.disponible) return [];

    let dispoRange: { start: number; end: number } | null = null;
    if (disponibilidad?.horaInicio && disponibilidad?.horaFin) {
      dispoRange = {
        start: this.getMinutesFromHourString(disponibilidad.horaInicio),
        end: this.getMinutesFromHourString(disponibilidad.horaFin),
      };
    }

    const existentes = await this.prisma.appointment.findMany({
      where: {
        profesionalId,
        fecha,
        estado: { not: AppointmentStatus.CANCELLED },
      },
      select: { horaInicio: true, horaFin: true },
    });
    const ocupados = existentes.map((a) => ({
      start: this.getMinutesFromDate(a.horaInicio),
      end: this.getMinutesFromDate(a.horaFin),
    }));

    const year = fecha.getUTCFullYear();
    const month = fecha.getUTCMonth();
    const day = fecha.getUTCDate();
    const sugerencias: { horaInicio: string; horaFin: string }[] = [];

    for (const range of scheduleRanges) {
      let cursor = Math.max(range.start, notBeforeMinutes);
      cursor =
        Math.ceil(cursor / SAME_DAY_SUGGESTION_STEP_MINUTES) *
        SAME_DAY_SUGGESTION_STEP_MINUTES;

      while (cursor + durationMinutes <= range.end) {
        const candidateEnd = cursor + durationMinutes;
        const dentroDeDispo =
          !dispoRange ||
          (cursor >= dispoRange.start && candidateEnd <= dispoRange.end);
        const chocaCierre = cierresParciales.some((c) =>
          this.rangesOverlap(cursor, candidateEnd, c.start, c.end),
        );
        const chocaCita = ocupados.some((o) =>
          this.rangesOverlap(cursor, candidateEnd, o.start, o.end),
        );

        if (dentroDeDispo && !chocaCierre && !chocaCita) {
          sugerencias.push({
            horaInicio: new Date(
              Date.UTC(
                year,
                month,
                day,
                Math.floor(cursor / 60),
                cursor % 60,
              ),
            ).toISOString(),
            horaFin: new Date(
              Date.UTC(
                year,
                month,
                day,
                Math.floor(candidateEnd / 60),
                candidateEnd % 60,
              ),
            ).toISOString(),
          });
          if (sugerencias.length >= maxSuggestions) return sugerencias;
        }
        cursor += SAME_DAY_SUGGESTION_STEP_MINUTES;
      }
    }

    return sugerencias;
  }

  /**
   * Arma las 3 opciones para resolver una cita que quedó en conflicto por
   * extender otra: reasignar a otro especialista libre, reprogramar (con
   * huecos sugeridos ese mismo día), o cancelar. No aplica nada solo —
   * un humano elige y llama al endpoint correspondiente.
   */
  private async buildConflictOptions(conflicto: {
    id: number;
    sedeId: number;
    serviceId: number;
    profesionalId: number;
    fecha: Date;
    horaInicio: Date;
    horaFin: Date;
    duracion: number;
    estado: AppointmentStatus;
    notas: string | null;
    userId: number;
    service?: {
      translations: { language: string; name: string }[];
    } | null;
    sede: SedeConHorarios;
    user?: {
      id: number;
      email: string;
      UserData?: { name?: string | null; phone?: string | null } | null;
    } | null;
  }) {
    const [especialistasLibres, huecosMismoDia] = await Promise.all([
      this.findFreeProfesionalesForSlot(
        conflicto.sedeId,
        conflicto.serviceId,
        conflicto.profesionalId,
        conflicto.horaInicio,
        conflicto.horaFin,
      ),
      this.findSameDayFreeSlots(
        conflicto.profesionalId,
        conflicto.sede,
        conflicto.fecha,
        conflicto.duracion,
        this.getMinutesFromDate(conflicto.horaFin),
      ),
    ]);

    return {
      appointment: this.buildAppointmentSummary({
        id: conflicto.id,
        serviceId: conflicto.serviceId,
        profesionalId: conflicto.profesionalId,
        sedeId: conflicto.sedeId,
        estado: conflicto.estado,
        fecha: conflicto.fecha,
        horaInicio: conflicto.horaInicio,
        horaFin: conflicto.horaFin,
        duracion: conflicto.duracion,
        notas: conflicto.notas,
        service: conflicto.service,
        user: conflicto.user,
      }),
      opciones: {
        reasignarEspecialista: {
          endpoint: `PATCH /appointments/${conflicto.id}/reassign`,
          especialistasDisponibles: especialistasLibres,
        },
        reprogramar: {
          endpoint: `PATCH /appointments/${conflicto.id}/reschedule`,
          huecosSugeridosMismoDia: huecosMismoDia,
        },
        cancelar: {
          endpoint: `PATCH /appointments/${conflicto.id}/cancel`,
        },
      },
    };
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

      // Avisar al administrador de la sede. Best-effort: si esto falla,
      // la reserva ya está creada y no debe verse afectada.
      this.notifyReservationAdmins(appointment, sede, service, profesional, user).catch(
        (notifyError) =>
          this.logger.error(
            `No se pudo notificar la reserva ${appointment.id}: ${notifyError?.message ?? notifyError}`,
          ),
      );

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
          profesional: {
            select: { id: true, nombre: true, phone: true, imagen: true },
          },
          sede: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              telefono: true,
              imagenes: true,
            },
          },
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
          profesional: {
            select: { id: true, nombre: true, phone: true, imagen: true },
          },
          sede: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              telefono: true,
              imagenes: true,
            },
          },
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
          // Para marcar en el panel las citas que se extendieron
          extensiones: { select: { id: true, duracion: true, estado: true } },
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
        extensiones: { select: { id: true, duracion: true, estado: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    return appointment;
  }

  async update(id: number, data: UpdateAppointmentDto) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    /* UpdateAppointmentDto hereda de CreateAppointmentDto, que incluye los
       campos del cobro (paymentMethod, paymentAmount, cardNumber...). Esos
       campos SI pasan el ValidationPipe, pero no son columnas de Appointment:
       con el spread anterior llegaban a Prisma y reventaban con un 500.
       Se descartan aqui, igual que hace create(). */
    const {
      paymentMethod: _paymentMethod,
      paymentAmount: _paymentAmount,
      cardNumber: _cardNumber,
      expiryDate: _expiryDate,
      cvv: _cvv,
      ...campos
    } = data as UpdateAppointmentDto & Record<string, unknown>;

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...campos,
        fecha: data.fecha ? new Date(data.fecha) : cita.fecha,
        horaInicio: data.horaInicio
          ? new Date(data.horaInicio)
          : cita.horaInicio,
        horaFin: data.horaFin ? new Date(data.horaFin) : cita.horaFin,
      },
    });
  }

  /**
   * El profesional no terminó a tiempo y necesita más minutos con el
   * cliente. Si el tramo extra está libre, crea una cita NUEVA de
   * extensión enlazada a la original (extensionDeId), con un pago
   * pendiente proporcional al precio de la original — el tiempo extra
   * queda registrado al cliente como otra cita. Si choca con otra cita del mismo profesional,
   * NO toca nada — devuelve las 3 opciones (reasignar/reprogramar/cancelar
   * esa otra cita) para que un humano decida y llame al endpoint que
   * corresponda.
   */
  async extend(
    id: number,
    dto: ExtendAppointmentDto,
    user?: AuthenticatedUser,
  ) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    if (cita.estado === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('No se puede extender una cita cancelada');
    }
    if (cita.estado === AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'No se puede extender una cita ya finalizada',
      );
    }

    await this.ensureCanManageAppointment(cita, user);

    // Si se extiende una extensión, la nueva se enlaza igualmente a la
    // cita original: el precio se calcula siempre sobre esa.
    const raizId = cita.extensionDeId ?? cita.id;
    const [raiz, extensiones] = await Promise.all([
      this.prisma.appointment.findUnique({
        where: { id: raizId },
        include: { Payment: true, service: { include: { prices: true } } },
      }),
      this.prisma.appointment.findMany({
        where: {
          extensionDeId: raizId,
          estado: { not: AppointmentStatus.CANCELLED },
        },
        select: { id: true, horaFin: true },
      }),
    ]);
    if (!raiz) throw new NotFoundException('Cita original no encontrada');

    // La extensión empieza donde termina el último tramo de la cadena
    // (original + extensiones previas), no necesariamente esta cita.
    const inicioExtension = new Date(
      Math.max(
        cita.horaFin.getTime(),
        raiz.horaFin.getTime(),
        ...extensiones.map((e) => e.horaFin.getTime()),
      ),
    );
    const finExtension = new Date(
      inicioExtension.getTime() + dto.extraMinutes * 60 * 1000,
    );
    const idsCadena = [raizId, ...extensiones.map((e) => e.id)];

    // Solo importa lo que choque contra el tramo NUEVO que se reclama; los
    // tramos de la propia cadena ya estaban libres por definición.
    const conflictos = await this.prisma.appointment.findMany({
      where: {
        id: { notIn: idsCadena },
        profesionalId: cita.profesionalId,
        estado: { not: AppointmentStatus.CANCELLED },
        horaInicio: { lt: finExtension },
        horaFin: { gt: inicioExtension },
      },
      orderBy: { horaInicio: 'asc' },
      include: {
        service: {
          include: {
            translations: { where: { language: 'es' }, take: 1 },
          },
        },
        sede: { include: { HorarioSede: true, DiaCerradoSede: true } },
        user: {
          select: {
            id: true,
            email: true,
            UserData: { select: { name: true, phone: true } },
          },
        },
      },
    });

    if (conflictos.length === 0) {
      // Precio proporcional al de la original: importe × minutos extra / duración.
      const precioBase =
        raiz.Payment?.totalAmount ??
        raiz.service.prices.find((p) => p.duration === raiz.duracion)?.amount ??
        raiz.service.prices[0]?.amount ??
        0;
      const importe =
        raiz.duracion > 0
          ? Math.round(((precioBase * dto.extraMinutes) / raiz.duracion) * 100) / 100
          : 0;

      const extension = await this.prisma.$transaction(async (tx) => {
        const nueva = await tx.appointment.create({
          data: {
            fecha: raiz.fecha,
            horaInicio: inicioExtension,
            horaFin: finExtension,
            duracion: dto.extraMinutes,
            estado:
              raiz.estado === AppointmentStatus.CONFIRMED
                ? AppointmentStatus.CONFIRMED
                : AppointmentStatus.PENDING,
            notas: dto.motivo
              ? `Extensión de la cita #${raizId}: ${dto.motivo}`
              : `Extensión de la cita #${raizId}`,
            sedeId: raiz.sedeId,
            serviceId: raiz.serviceId,
            profesionalId: raiz.profesionalId,
            userId: raiz.userId,
            extensionDeId: raizId,
          },
        });

        // Directo con Prisma y no con PaymentService.createPayment: ese
        // intentaría procesar una tarjeta y aquí no hay datos de tarjeta.
        // Queda pendiente de cobro con el mismo método que la original.
        if (importe > 0) {
          await tx.payment.create({
            data: {
              appointmentId: nueva.id,
              userId: raiz.userId,
              serviceId: raiz.serviceId,
              method: raiz.Payment?.method ?? PaymentMethod.CASH,
              totalAmount: importe,
              paidAmount: 0,
              status: PaymentStatus.PENDING,
            },
          });
        }

        return nueva;
      });

      await this.logAppointmentHistory(
        raizId,
        AppointmentHistoryAction.EXTENDED,
        { horaFin: inicioExtension.toISOString() },
        {
          extensionId: extension.id,
          horaInicio: inicioExtension.toISOString(),
          horaFin: finExtension.toISOString(),
          duracion: dto.extraMinutes,
          importe,
        },
        user?.userId,
        dto.motivo,
      );

      return { status: 'EXTENDED' as const, appointment: cita, extension };
    }

    const citasEnConflicto = await Promise.all(
      conflictos.map((conflicto) => this.buildConflictOptions(conflicto)),
    );

    await this.logAppointmentHistory(
      id,
      AppointmentHistoryAction.EXTEND_CONFLICT_DETECTED,
      { horaFin: inicioExtension.toISOString() },
      {
        horaInicioSolicitada: inicioExtension.toISOString(),
        horaFinSolicitada: finExtension.toISOString(),
        extraMinutes: dto.extraMinutes,
      },
      user?.userId,
      dto.motivo,
    );

    return {
      status: 'CONFLICT' as const,
      solicitud: {
        extraMinutes: dto.extraMinutes,
        nuevaHoraFin: finExtension.toISOString(),
      },
      mensaje:
        'Extender esta cita choca con otra reserva del mismo profesional. Elegí una opción para la(s) cita(s) afectada(s).',
      citasEnConflicto,
    };
  }

  /**
   * Mueve la cita a otro especialista que ofrezca el mismo servicio en la
   * misma sede y esté libre en ese horario exacto. Pensado como una de las
   * opciones para resolver el conflicto que devuelve extend().
   */
  async reassign(
    id: number,
    dto: ReassignAppointmentDto,
    user?: AuthenticatedUser,
  ) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    if (cita.estado === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('No se puede reasignar una cita cancelada');
    }
    if (cita.estado === AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'No se puede reasignar una cita ya finalizada',
      );
    }

    await this.ensureCanManageAppointment(cita, user);

    if (dto.nuevoProfesionalId === cita.profesionalId) {
      throw new BadRequestException(
        'La cita ya está asignada a ese profesional',
      );
    }

    const [nuevoProfesional, relacion, ocupado] = await Promise.all([
      this.prisma.profesional.findUnique({
        where: { id: dto.nuevoProfesionalId },
      }),
      this.prisma.serviceSedeProfesional.findFirst({
        where: {
          sedeId: cita.sedeId,
          serviceId: cita.serviceId,
          profesionalId: dto.nuevoProfesionalId,
        },
      }),
      this.prisma.appointment.findFirst({
        where: {
          id: { not: id },
          profesionalId: dto.nuevoProfesionalId,
          estado: { not: AppointmentStatus.CANCELLED },
          horaInicio: { lt: cita.horaFin },
          horaFin: { gt: cita.horaInicio },
        },
      }),
    ]);

    if (!nuevoProfesional) {
      throw new NotFoundException('El nuevo profesional no existe');
    }
    if (nuevoProfesional.state !== ClientState.enabled) {
      throw new BadRequestException('El nuevo profesional no está disponible');
    }
    if (!relacion) {
      throw new BadRequestException(
        'El nuevo profesional no ofrece este servicio en esta sede',
      );
    }
    if (ocupado) {
      throw new BadRequestException(
        'El nuevo profesional ya tiene una cita en ese horario',
      );
    }

    const actualizada = await this.prisma.appointment.update({
      where: { id },
      data: { profesionalId: dto.nuevoProfesionalId },
    });

    await this.logAppointmentHistory(
      id,
      AppointmentHistoryAction.REASSIGNED,
      { profesionalId: cita.profesionalId },
      { profesionalId: dto.nuevoProfesionalId },
      user?.userId,
      dto.motivo,
    );

    await this.notifyClientAboutChange(
      { ...cita, profesionalId: dto.nuevoProfesionalId },
      'REASSIGNED',
    );

    return actualizada;
  }

  /** Nota sobre el cliente que espera a ser atendido. */
  async setObservacionEspera(id: number, dto: ObservacionEsperaDto) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    const texto = dto.observacionEspera?.trim();
    return this.prisma.appointment.update({
      where: { id },
      data: { observacionEspera: texto ? texto : null },
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
    user?: AuthenticatedUser,
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

    const actualizada = await this.prisma.appointment.update({
      where: { id },
      data: {
        fecha,
        horaInicio,
        horaFin,
        notas: motivo,
      },
    });

    await this.logAppointmentHistory(
      id,
      AppointmentHistoryAction.RESCHEDULED,
      {
        fecha: cita.fecha.toISOString(),
        horaInicio: cita.horaInicio.toISOString(),
        horaFin: cita.horaFin.toISOString(),
      },
      {
        fecha: fecha.toISOString(),
        horaInicio: horaInicio.toISOString(),
        horaFin: horaFin.toISOString(),
      },
      user?.userId,
      data.motivo,
    );

    await this.notifyClientAboutChange(
      { ...cita, fecha, horaInicio },
      'RESCHEDULED',
    );

    return actualizada;
  }

  async cancel(
    id: number,
    motivo = 'Cancelado por el usuario',
    user?: AuthenticatedUser,
  ) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    const actualizada = await this.prisma.appointment.update({
      where: { id },
      data: {
        estado: AppointmentStatus.CANCELLED,
        notas: motivo,
      },
    });

    await this.logAppointmentHistory(
      id,
      AppointmentHistoryAction.CANCELLED,
      { estado: cita.estado },
      { estado: AppointmentStatus.CANCELLED },
      user?.userId,
      motivo,
    );

    await this.notifyClientAboutChange(cita, 'CANCELLED');

    return actualizada;
  }

  async getProfesionalAppointments(profesionalId: number) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
    });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }

    const [pendingAppointments, completedAppointments] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          profesionalId,
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
          profesional: {
            select: { id: true, nombre: true, phone: true, imagen: true },
          },
          sede: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              telefono: true,
              imagenes: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              UserData: { select: { name: true, phone: true } },
            },
          },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          profesionalId,
          estado: AppointmentStatus.COMPLETED,
        },
        orderBy: { fecha: 'desc' },
        include: {
          service: {
            select: {
              translations: { select: { language: true, name: true } },
            },
          },
          profesional: {
            select: { id: true, nombre: true, phone: true, imagen: true },
          },
          sede: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              telefono: true,
              imagenes: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              UserData: { select: { name: true, phone: true } },
            },
          },
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

  async remove(id: number) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    return this.prisma.appointment.delete({ where: { id } });
  }
}
