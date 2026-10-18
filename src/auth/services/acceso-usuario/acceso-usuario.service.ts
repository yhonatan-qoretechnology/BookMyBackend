import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RegistrarAccesoInput {
  email: string;
  userId?: number | null;
  exito: boolean;
  motivoFallo?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ListarAccesosParams {
  page?: number;
  limit?: number;
  userId?: number;
  email?: string;
  pais?: string;
  soloFallidos?: boolean;
  desde?: Date;
  hasta?: Date;
}

/**
 * Página de "Seguimiento y Control" del SUPER_ADMIN: auditoría de login
 * (IP, país/región/ciudad, dispositivo) — puramente de lectura, nunca
 * bloquea ni condiciona el login en sí.
 *
 * La geolocalización es local (geoip-lite, trae su propia base de datos
 * tipo MaxMind GeoLite2) y el parseo de dispositivo también es local
 * (ua-parser-js, solo interpreta el string del header) — ninguno de los
 * dos llama a un servicio externo, así que no dependen de que haya
 * internet ni se ven afectados por la intermitencia de red que ya dio
 * problemas antes en este proyecto con otras integraciones (fakebank.com,
 * calendariosnacionales.com).
 */
@Injectable()
export class AccesoUsuarioService {
  private readonly logger = new Logger(AccesoUsuarioService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un intento de login, exitoso o no. Best-effort: si algo acá
   * falla (geoip-lite no reconoce la IP, el insert falla, etc.) nunca debe
   * tumbar el login — por eso AuthService.login() llama a esto sin esperar
   * (fire-and-forget) y con un .catch() propio además del try/catch interno.
   */
  async registrar(input: RegistrarAccesoInput): Promise<void> {
    try {
      const ipLimpia = this.limpiarIp(input.ip);
      const geo = ipLimpia ? geoip.lookup(ipLimpia) : null;
      const ua = input.userAgent ? new UAParser(input.userAgent) : null;
      const dispositivo = ua?.getDevice().type;

      await this.prisma.accesoUsuario.create({
        data: {
          email: input.email,
          userId: input.userId ?? undefined,
          exito: input.exito,
          motivoFallo: input.motivoFallo ?? null,
          ipAddress: ipLimpia ?? 'desconocida',
          pais: geo?.country ?? null,
          region: geo?.region ?? null,
          ciudad: geo?.city ?? null,
          userAgent: input.userAgent ?? null,
          // ua-parser-js deja `device.type` sin definir para desktop (solo
          // lo completa para mobile/tablet/smarttv/etc) — se normaliza acá.
          dispositivo: dispositivo ?? 'desktop',
          navegador: ua?.getBrowser().name ?? null,
          sistemaOperativo: ua?.getOS().name ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el acceso de ${input.email}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  /**
   * Localhost (desarrollo) y el prefijo IPv4-mapped de IPv6 (`::ffff:`) no
   * resuelven en geoip-lite — se limpia el prefijo igual para que quede
   * una IP legible, aunque no tenga país.
   */
  private limpiarIp(ip?: string | null): string | null {
    if (!ip) return null;
    return ip.replace(/^::ffff:/, '').trim() || null;
  }

  /** Cola paginada y filtrable para el panel de SUPER_ADMIN. */
  async listar(params: ListarAccesosParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 25;

    const where: Prisma.AccesoUsuarioWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.email
        ? { email: { contains: params.email, mode: 'insensitive' } }
        : {}),
      ...(params.pais ? { pais: params.pais } : {}),
      ...(params.soloFallidos ? { exito: false } : {}),
      ...(params.desde || params.hasta
        ? {
            createdAt: {
              ...(params.desde ? { gte: params.desde } : {}),
              ...(params.hasta ? { lte: params.hasta } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.accesoUsuario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.accesoUsuario.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Resumen para las tarjetas de arriba del panel: intentos totales,
   * fallidos y países distintos en la ventana pedida (por defecto, 30 días).
   */
  async resumen(dias = 30) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const [total, fallidos, paisesDistintos] = await Promise.all([
      this.prisma.accesoUsuario.count({ where: { createdAt: { gte: desde } } }),
      this.prisma.accesoUsuario.count({
        where: { createdAt: { gte: desde }, exito: false },
      }),
      this.prisma.accesoUsuario.findMany({
        where: { createdAt: { gte: desde }, pais: { not: null } },
        select: { pais: true },
        distinct: ['pais'],
      }),
    ]);

    return {
      dias,
      total,
      fallidos,
      exitosos: total - fallidos,
      paisesDistintos: paisesDistintos.length,
    };
  }
}
