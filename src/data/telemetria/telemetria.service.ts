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

  /**
   * Serie diaria para las gráficas: pageviews, visitantes distintos y
   * aperturas de la app, del periodo pedido y del anterior (para
   * compararlos), más el reparto de visitas por país. Días en UTC.
   */
  async serie(dias = 30) {
    const DIA = 24 * 60 * 60 * 1000;
    const n = Math.min(Math.max(dias, 1), 365);
    const hoy = new Date();
    const finHoy = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) + DIA;
    const inicioActual = finHoy - n * DIA;
    const inicioPrevio = inicioActual - n * DIA;

    const eventos = await this.prisma.telemetriaEvento.findMany({
      where: { createdAt: { gte: new Date(inicioPrevio) } },
      select: { tipo: true, sesionId: true, pais: true, createdAt: true },
    });

    const vacio = () => Array.from({ length: n }, () => 0);
    const periodo = () => ({
      pageviews: vacio(),
      visitantes: vacio(),
      appSessions: vacio(),
      sesiones: Array.from({ length: n }, () => new Set<string>()),
    });
    const actual = periodo();
    const previo = periodo();
    const paises = new Map<string, number>();

    for (const e of eventos) {
      const t = e.createdAt.getTime();
      const enActual = t >= inicioActual;
      const p = enActual ? actual : previo;
      const i = Math.floor((t - (enActual ? inicioActual : inicioPrevio)) / DIA);
      if (i < 0 || i >= n) continue;
      if (e.tipo === 'PAGEVIEW') {
        p.pageviews[i]++;
        if (e.sesionId) p.sesiones[i].add(e.sesionId);
      } else {
        p.appSessions[i]++;
      }
      if (enActual && e.pais) paises.set(e.pais, (paises.get(e.pais) ?? 0) + 1);
    }

    const cerrar = (p: ReturnType<typeof periodo>) => ({
      pageviews: p.pageviews,
      visitantes: p.sesiones.map((s) => s.size),
      appSessions: p.appSessions,
    });

    return {
      dias: Array.from({ length: n }, (_, i) =>
        new Date(inicioActual + i * DIA).toISOString().slice(0, 10),
      ),
      actual: cerrar(actual),
      previo: cerrar(previo),
      paises: [...paises.entries()]
        .map(([pais, eventos]) => ({ pais, eventos }))
        .sort((a, b) => b.eventos - a.eventos)
        .slice(0, 10),
    };
  }
}
