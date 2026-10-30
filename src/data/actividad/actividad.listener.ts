import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import { ActividadEvento } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ACCIONES, RECURSOS, VERBOS } from './actividad.catalogo';

/**
 * Centro de alertas para cualquier acción del panel (no solo reservas).
 * Avisa a quien supervisa el negocio, nunca a quien hizo la acción:
 *   · los dueños (COMPANY_ADMIN) de la empresa;
 *   · los admins de la sede (BRANCH_ADMIN) si la acción es de una sede.
 * Las citas nuevas, canceladas y reagendadas ya tienen avisos propios
 * (NotificationService.notifyNewReservation / notifyAppointmentChanged),
 * así que aquí se saltan para no duplicarlos.
 */
@Injectable()
export class ActividadListener {
  private readonly logger = new Logger(ActividadListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificationService,
  ) {}

  @OnEvent('actividad.**', { async: true })
  async avisar(evento: ActividadEvento) {
    try {
      const recurso = RECURSOS.find((r) => r.recurso === evento.recurso);
      if (!recurso?.notifica || !evento.empresaId) return;
      if (evento.recurso === 'cita' && ['creado', 'cancelado', 'reagendado'].includes(evento.accion)) return;

      const [duenos, adminsSede] = await Promise.all([
        this.prisma.adminProfile.findMany({
          where: { empresaId: evento.empresaId, user: { role: Role.COMPANY_ADMIN } },
          select: { userId: true },
        }),
        evento.sedeId
          ? this.prisma.adminProfile.findMany({
              where: { sedeId: evento.sedeId, user: { role: Role.BRANCH_ADMIN } },
              select: { userId: true },
            })
          : Promise.resolve([] as { userId: number }[]),
      ]);
      const destinatarios = new Set([...duenos, ...adminsSede].map((a) => a.userId));
      destinatarios.delete(evento.userId);
      if (destinatarios.size === 0) return;

      const verbo = VERBOS[evento.accion] ?? evento.accion;
      const objeto = recurso.etiqueta.toLowerCase();
      const titulo = `${recurso.etiqueta} · ${ACCIONES[evento.accion] ?? evento.accion}`;
      const cuerpo = `${evento.email} ${verbo}: ${objeto}${evento.recursoId ? ` #${evento.recursoId}` : ''}.`;

      await this.notificaciones.notificarActividad([...destinatarios], {
        tipo: `actividad.${evento.recurso}.${evento.accion}`,
        titulo,
        cuerpo,
        datos: { ruta: recurso.ruta, recurso: evento.recurso, recursoId: evento.recursoId },
      });
    } catch (error) {
      this.logger.warn(`No se pudo notificar la actividad: ${error instanceof Error ? error.message : error}`);
    }
  }
}
