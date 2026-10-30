import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AccionAutomatizacion,
  DestinoAutomatizacion,
  EstadoCampana,
  EstadoEjecucion,
  PlanEmpresa,
  Prisma,
  Role,
  SegmentoCampana,
} from '@prisma/client';
import Handlebars from 'handlebars';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../email/mail.service';
import { NotificationService } from '../notification/notification.service';
import { esEventoAutomatizable, eventosAutomatizables, VARIABLES } from './automatizacion.catalogo';
import {
  ActualizarAutomatizacionDto,
  ActualizarCampanaDto,
  CrearAutomatizacionDto,
  CrearCampanaDto,
} from './dto/automatizacion.dto';

/** Lote máximo por pasada del cron, para no saturar el SMTP. */
const LOTE = 50;

/**
 * Motor de automatizaciones y campañas.
 *
 * Automatización = "cuando pase EVENTO, (tras N minutos) envía un correo
 * o una notificación". Al ocurrir el evento se crea una Ejecución
 * PENDIENTE con su hora; el cron de cada minuto envía las que ya tocan.
 * Pasar siempre por la cola (también con 0 minutos) hace que un fallo
 * del SMTP no se pierda: queda FALLIDA con el motivo, a la vista.
 *
 * Campaña = un correo a un segmento de negocios (todos, Pro, Free, en
 * prueba) en una fecha. El cron la envía cuando llega su hora.
 */
@Injectable()
export class AutomatizacionService {
  private readonly logger = new Logger(AutomatizacionService.name);
  private procesando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notificaciones: NotificationService,
  ) {}

  /* ── Catálogo ───────────────────────────────────────────── */
  eventos() {
    return { eventos: eventosAutomatizables(), variables: VARIABLES };
  }

  /* ── CRUD de automatizaciones ───────────────────────────── */
  listar() {
    return this.prisma.automatizacion.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { ejecuciones: true } },
        ejecuciones: { orderBy: { createdAt: 'desc' }, take: 1, select: { estado: true, createdAt: true } },
      },
    });
  }

  crear(dto: CrearAutomatizacionDto, user: AuthenticatedUser) {
    this.validarEvento(dto.evento);
    this.validarPlantilla(dto.asunto, dto.mensaje);
    return this.prisma.automatizacion.create({ data: { ...dto, creadoPorId: user.userId } });
  }

  async actualizar(id: number, dto: ActualizarAutomatizacionDto) {
    await this.existe(id);
    if (dto.evento) this.validarEvento(dto.evento);
    if (dto.asunto || dto.mensaje) this.validarPlantilla(dto.asunto ?? '', dto.mensaje ?? '');
    return this.prisma.automatizacion.update({ where: { id }, data: dto });
  }

  async eliminar(id: number) {
    await this.existe(id);
    await this.prisma.automatizacion.delete({ where: { id } });
    return { ok: true };
  }

  ejecuciones(automatizacionId?: number) {
    return this.prisma.ejecucionAutomatizacion.findMany({
      where: automatizacionId ? { automatizacionId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { automatizacion: { select: { nombre: true } } },
    });
  }

  private async existe(id: number) {
    const a = await this.prisma.automatizacion.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw new NotFoundException('La automatización no existe.');
  }

  private validarEvento(evento: string) {
    if (!esEventoAutomatizable(evento)) throw new BadRequestException(`Evento desconocido: ${evento}`);
  }

  private validarPlantilla(...textos: string[]) {
    for (const t of textos) {
      try {
        Handlebars.precompile(t);
      } catch {
        throw new BadRequestException('Revisa las variables del texto: alguna {{ }} está mal cerrada.');
      }
    }
  }

  /* ── Disparo por eventos ────────────────────────────────── */

  /**
   * Llamado por AutomatizacionListener con cada evento. Los que no tienen
   * automatizaciones activas cuestan una consulta indexada (evento, activa).
   */
  async encolar(evento: string, payload: Record<string, unknown>) {
    try {
      const reglas = await this.prisma.automatizacion.findMany({ where: { evento, activa: true } });
      if (reglas.length === 0) return;
      const empresaId = typeof payload?.empresaId === 'number' ? payload.empresaId : null;
      const ahora = Date.now();
      await this.prisma.ejecucionAutomatizacion.createMany({
        data: reglas.map((r) => ({
          automatizacionId: r.id,
          empresaId,
          payload: payload as Prisma.InputJsonValue,
          programadaPara: new Date(ahora + r.retrasoMinutos * 60_000),
        })),
      });
    } catch (error) {
      this.logger.error(`No se pudo encolar "${evento}": ${error instanceof Error ? error.message : error}`);
    }
  }

  /* ── Cron: envía lo que ya toca ─────────────────────────── */
  @Cron(CronExpression.EVERY_MINUTE)
  async procesar() {
    if (this.procesando) return;
    this.procesando = true;
    try {
      await this.procesarEjecuciones();
      await this.procesarCampanas();
    } finally {
      this.procesando = false;
    }
  }

  private async procesarEjecuciones() {
    const pendientes = await this.prisma.ejecucionAutomatizacion.findMany({
      where: { estado: EstadoEjecucion.PENDIENTE, programadaPara: { lte: new Date() } },
      orderBy: { programadaPara: 'asc' },
      take: LOTE,
      include: { automatizacion: true },
    });

    for (const ej of pendientes) {
      // Reclama la ejecución: si otra instancia ya la tomó, se salta.
      const { count } = await this.prisma.ejecucionAutomatizacion.updateMany({
        where: { id: ej.id, estado: EstadoEjecucion.PENDIENTE },
        data: { estado: EstadoEjecucion.ENVIADA, ejecutadaEn: new Date() },
      });
      if (count === 0) continue;

      try {
        const enviados = await this.ejecutar(ej.automatizacion, ej.empresaId, (ej.payload ?? {}) as Record<string, unknown>);
        if (enviados === 0) {
          await this.prisma.ejecucionAutomatizacion.update({
            where: { id: ej.id },
            data: { estado: EstadoEjecucion.OMITIDA, error: 'No había destinatarios.' },
          });
        }
      } catch (error) {
        await this.prisma.ejecucionAutomatizacion.update({
          where: { id: ej.id },
          data: { estado: EstadoEjecucion.FALLIDA, error: (error instanceof Error ? error.message : String(error)).slice(0, 500) },
        });
      }
    }
  }

  /** Envía una automatización; devuelve a cuántos destinatarios llegó. */
  private async ejecutar(
    regla: { accion: AccionAutomatizacion; destino: DestinoAutomatizacion; asunto: string; mensaje: string },
    empresaId: number | null,
    payload: Record<string, unknown>,
  ): Promise<number> {
    const empresa = empresaId
      ? await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, email: true } })
      : null;
    const variables = {
      ...payload,
      empresa: empresa?.nombre ?? '',
      fecha: new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
    };
    const asunto = Handlebars.compile(regla.asunto, { noEscape: true })(variables);
    const mensaje = Handlebars.compile(regla.mensaje, { noEscape: true })(variables);

    if (regla.accion === AccionAutomatizacion.EMAIL) {
      const correos =
        regla.destino === DestinoAutomatizacion.SUPERADMINS
          ? (await this.prisma.users.findMany({ where: { role: Role.SUPER_ADMIN }, select: { email: true } })).map((u) => u.email)
          : empresa?.email
            ? [empresa.email]
            : [];
      for (const to of correos) await this.mail.sendGenerico({ to, asunto, mensaje });
      return correos.length;
    }

    const userIds =
      regla.destino === DestinoAutomatizacion.SUPERADMINS
        ? (await this.prisma.users.findMany({ where: { role: Role.SUPER_ADMIN }, select: { id: true } })).map((u) => u.id)
        : empresaId
          ? (
              await this.prisma.adminProfile.findMany({
                where: { empresaId, user: { role: Role.COMPANY_ADMIN } },
                select: { userId: true },
              })
            ).map((a) => a.userId)
          : [];
    await this.notificaciones.notificarActividad(userIds, { tipo: 'automatizacion', titulo: asunto, cuerpo: mensaje });
    return userIds.length;
  }

  /* ── Campañas ───────────────────────────────────────────── */
  campanas() {
    return this.prisma.campanaEmail.findMany({ orderBy: { createdAt: 'desc' } });
  }

  crearCampana(dto: CrearCampanaDto, user: AuthenticatedUser) {
    this.validarPlantilla(dto.asunto, dto.mensaje);
    return this.prisma.campanaEmail.create({
      data: {
        nombre: dto.nombre,
        asunto: dto.asunto,
        mensaje: dto.mensaje,
        segmento: dto.segmento ?? SegmentoCampana.TODAS,
        programadaPara: dto.programadaPara ? new Date(dto.programadaPara) : null,
        estado: dto.programadaPara ? EstadoCampana.PROGRAMADA : EstadoCampana.BORRADOR,
        creadoPorId: user.userId,
      },
    });
  }

  async actualizarCampana(id: number, dto: ActualizarCampanaDto) {
    const c = await this.prisma.campanaEmail.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('La campaña no existe.');
    if (c.estado === EstadoCampana.ENVIANDO || c.estado === EstadoCampana.ENVIADA) {
      throw new BadRequestException('Una campaña enviada ya no se puede editar.');
    }
    if (dto.asunto || dto.mensaje) this.validarPlantilla(dto.asunto ?? '', dto.mensaje ?? '');
    const programadaPara =
      dto.programadaPara !== undefined ? (dto.programadaPara ? new Date(dto.programadaPara) : null) : c.programadaPara;
    return this.prisma.campanaEmail.update({
      where: { id },
      data: {
        ...dto,
        programadaPara,
        estado: programadaPara ? EstadoCampana.PROGRAMADA : EstadoCampana.BORRADOR,
      },
    });
  }

  async cancelarCampana(id: number) {
    const c = await this.prisma.campanaEmail.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('La campaña no existe.');
    if (c.estado === EstadoCampana.ENVIADA || c.estado === EstadoCampana.ENVIANDO) {
      throw new BadRequestException('La campaña ya se envió.');
    }
    return this.prisma.campanaEmail.update({ where: { id }, data: { estado: EstadoCampana.CANCELADA } });
  }

  /** Cuántos negocios recibirían una campaña de ese segmento. */
  async contarSegmento(segmento: SegmentoCampana) {
    return { segmento, destinatarios: (await this.destinatarios(segmento)).length };
  }

  private async destinatarios(segmento: SegmentoCampana) {
    const ahora = new Date();
    const where: Prisma.EmpresaWhereInput = { email: { not: null }, bloqueada: false };
    if (segmento === SegmentoCampana.PRO) where.plan = PlanEmpresa.PRO;
    if (segmento === SegmentoCampana.FREE) Object.assign(where, { plan: PlanEmpresa.FREE, OR: [{ trialEndsAt: null }, { trialEndsAt: { lte: ahora } }] });
    if (segmento === SegmentoCampana.PRUEBA) Object.assign(where, { plan: PlanEmpresa.FREE, trialEndsAt: { gt: ahora } });
    const empresas = await this.prisma.empresa.findMany({ where, select: { nombre: true, email: true } });
    // Un correo por dirección aunque la compartan varios negocios.
    const vistos = new Set<string>();
    return empresas.filter((e) => {
      const k = e.email!.trim().toLowerCase();
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }

  private async procesarCampanas() {
    const listas = await this.prisma.campanaEmail.findMany({
      where: { estado: EstadoCampana.PROGRAMADA, programadaPara: { lte: new Date() } },
      take: 3,
    });
    for (const c of listas) {
      const { count } = await this.prisma.campanaEmail.updateMany({
        where: { id: c.id, estado: EstadoCampana.PROGRAMADA },
        data: { estado: EstadoCampana.ENVIANDO },
      });
      if (count === 0) continue;

      const destinos = await this.destinatarios(c.segmento);
      let enviados = 0;
      let fallidos = 0;
      for (const d of destinos) {
        try {
          const vars = { empresa: d.nombre, fecha: new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) };
          await this.mail.sendGenerico({
            to: d.email!,
            asunto: Handlebars.compile(c.asunto, { noEscape: true })(vars),
            mensaje: Handlebars.compile(c.mensaje, { noEscape: true })(vars),
          });
          enviados++;
        } catch (error) {
          fallidos++;
          this.logger.warn(`Campaña ${c.id}: no se pudo enviar a ${d.email}: ${error instanceof Error ? error.message : error}`);
        }
      }
      await this.prisma.campanaEmail.update({
        where: { id: c.id },
        data: { estado: EstadoCampana.ENVIADA, enviadaEn: new Date(), destinatarios: destinos.length, enviados, fallidos },
      });
      this.logger.log(`Campaña ${c.id} enviada: ${enviados}/${destinos.length} (${fallidos} fallidos).`);
    }
  }
}
