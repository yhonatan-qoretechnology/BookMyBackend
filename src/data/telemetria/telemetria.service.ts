import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { PrismaService } from '../../prisma/prisma.service';

export interface RegistrarPageviewInput {
  ruta: string;
  sesionId: string;
  userId?: number | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RegistrarAppSessionInput {
  plataforma: 'ios' | 'android';
  ip?: string | null;
}

/**
 * Telemetría del panel y la web pública de bookmy-next (PAGEVIEW) y proxy
 * de distribución por plataforma de la app móvil (APP_SESSION). Es solo
 * lectura para el SUPER_ADMIN — nunca condiciona nada del lado de quien
 * navega. Misma filosofía best-effort que AccesoUsuarioService: un fallo
 * acá nunca puede tumbar la página ni el intento de login.
 */
@Injectable()
export class TelemetriaService {
  private readonly logger = new Logger(TelemetriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private limpiarIp(ip?: string | null): string | null {
    if (!ip) return null;
    return ip.replace(/^::ffff:/, '').trim() || null;
  }

  async registrarPageview(input: RegistrarPageviewInput): Promise<void> {
    try {
      const ipLimpia = this.limpiarIp(input.ip);
      const geo = ipLimpia ? geoip.lookup(ipLimpia) : null;

      await this.prisma.telemetriaEvento.create({
        data: {
          tipo: 'PAGEVIEW',
          ruta: input.ruta,
          sesionId: input.sesionId,
          userId: input.userId ?? undefined,
          ipAddress: ipLimpia,
          pais: geo?.country ?? null,
          region: geo?.region ?? null,
          ciudad: geo?.city ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar el pageview de ${input.ruta}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async registrarAppSession(input: RegistrarAppSessionInput): Promise<void> {
    try {
      const ipLimpia = this.limpiarIp(input.ip);
      const geo = ipLimpia ? geoip.lookup(ipLimpia) : null;

      await this.prisma.telemetriaEvento.create({
        data: {
          tipo: 'APP_SESSION',
          plataforma: input.plataforma,
          ipAddress: ipLimpia,
          pais: geo?.country ?? null,
          region: geo?.region ?? null,
          ciudad: geo?.city ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar la apertura de app (${input.plataforma}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  /** Totales para las tarjetas del panel de SUPER_ADMIN. */
  async resumen(dias = 30) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const [pageviews, appSessions, sesionesDistintas, paisesDistintos] =
      await Promise.all([
        this.prisma.telemetriaEvento.count({
          where: { tipo: 'PAGEVIEW', createdAt: { gte: desde } },
        }),
        this.prisma.telemetriaEvento.count({
          where: { tipo: 'APP_SESSION', createdAt: { gte: desde } },
        }),
        this.prisma.telemetriaEvento.findMany({
          where: {
            tipo: 'PAGEVIEW',
            createdAt: { gte: desde },
            sesionId: { not: null },
          },
          select: { sesionId: true },
          distinct: ['sesionId'],
        }),
        this.prisma.telemetriaEvento.findMany({
          where: { createdAt: { gte: desde }, pais: { not: null } },
          select: { pais: true },
          distinct: ['pais'],
        }),
      ]);

    return {
      dias,
      pageviews,
      appSessions,
      visitantesDistintos: sesionesDistintas.length,
      paisesDistintos: paisesDistintos.length,
    };
  }

  /** Páginas más visitadas del panel/web en la ventana pedida. */
  async paginasMasVistas(dias = 30, limit = 10) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const grupos = await this.prisma.telemetriaEvento.groupBy({
      by: ['ruta'],
      where: { tipo: 'PAGEVIEW', createdAt: { gte: desde }, ruta: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { ruta: 'desc' } },
      take: limit,
    });
    return grupos.map((g) => ({ ruta: g.ruta as string, visitas: g._count._all }));
  }

  /** Aperturas de la app agrupadas por plataforma y país — el proxy de
      "distribución" mientras no haya conteo real de descargas. */
  async distribucionPlataformas(dias = 30) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const grupos = await this.prisma.telemetriaEvento.groupBy({
      by: ['plataforma', 'pais'],
      where: { tipo: 'APP_SESSION', createdAt: { gte: desde } },
      _count: { _all: true },
      orderBy: { _count: { plataforma: 'desc' } },
    });
    return grupos.map((g) => ({
      plataforma: g.plataforma,
      pais: g.pais,
      sesiones: g._count._all,
    }));
  }
}
