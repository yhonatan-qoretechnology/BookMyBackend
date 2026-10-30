import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ActividadEvento, eventoActividad } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';
import { RUTAS_IGNORADAS, accionDe, recursoDeRuta } from './actividad.catalogo';

/**
 * Registra la actividad del panel y emite `actividad.<recurso>.<accion>`
 * para que la escuchen las notificaciones y las automatizaciones.
 */
@Injectable()
export class ActividadService {
  private readonly logger = new Logger(ActividadService.name);
  /** sedeId → empresaId: el admin de sede no lleva la empresa en el token. */
  private readonly empresaDeSede = new Map<number, number | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventEmitter2,
  ) {}

  async registrar(input: {
    user: AuthenticatedUser;
    metodo: string;
    ruta: string;
    respuesta: unknown;
  }): Promise<void> {
    try {
      const ruta = input.ruta.replace(/\/+$/, '') || '/';
      if (RUTAS_IGNORADAS.some((p) => ruta.toLowerCase().startsWith(p.toLowerCase()))) return;

      const catalogo = recursoDeRuta(ruta);
      const recurso = catalogo?.recurso ?? (ruta.split('/').filter(Boolean)[0] || 'otro').slice(0, 60);
      const accion = accionDe(input.metodo, ruta);
      const recursoId = this.idDe(input.respuesta, ruta);

      const sedeId = input.user.sedeId ?? null;
      const empresaId =
        input.user.empresaId ??
        (sedeId ? await this.empresaDe(sedeId) : null) ??
        this.empresaDeRespuesta(input.respuesta);

      await this.prisma.actividadPanel.create({
        data: {
          userId: input.user.userId,
          rol: input.user.role,
          empresaId,
          sedeId,
          recurso,
          accion,
          recursoId,
          metodo: input.metodo,
          ruta: ruta.slice(0, 200),
        },
      });

      const evento: ActividadEvento = {
        userId: input.user.userId,
        email: input.user.email,
        rol: input.user.role,
        empresaId,
        sedeId,
        recurso,
        accion,
        recursoId,
        ruta,
      };
      this.eventos.emit(eventoActividad(recurso, accion), evento);
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar la actividad ${input.metodo} ${input.ruta}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private idDe(respuesta: unknown, ruta: string): string | null {
    const r = respuesta as Record<string, unknown> | null;
    const candidato =
      (r && typeof r === 'object' && (r.id ?? (r.user as Record<string, unknown>)?.id ?? (r.data as Record<string, unknown>)?.id)) ??
      ruta.split('/').find((s) => /^\d+$/.test(s));
    return candidato != null ? String(candidato).slice(0, 40) : null;
  }

  private empresaDeRespuesta(respuesta: unknown): number | null {
    const r = respuesta as Record<string, unknown> | null;
    const v = r && typeof r === 'object' ? r.empresaId : null;
    return typeof v === 'number' ? v : null;
  }

  private async empresaDe(sedeId: number): Promise<number | null> {
    if (this.empresaDeSede.has(sedeId)) return this.empresaDeSede.get(sedeId)!;
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } });
    const empresaId = sede?.empresaId ?? null;
    this.empresaDeSede.set(sedeId, empresaId);
    return empresaId;
  }
}
