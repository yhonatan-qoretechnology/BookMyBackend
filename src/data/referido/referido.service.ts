import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EstadoPagoPlan, EstadoReferido, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BOOKMY_EVENTS } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Programa de referidos entre negocios.
 *
 * 1. Cada negocio tiene un código (se crea la primera vez que lo pide).
 * 2. Otro negocio se registra con ese código (bookmy.es/crear-cuenta?ref=…):
 *    queda un Referido PENDIENTE.
 * 3. Cuando el invitado paga su PRIMER mes de Pro (plan-pago.pagado), los
 *    dos ganan puntos y el referido pasa a RECOMPENSADO. Premiar el pago y
 *    no el registro evita que se inflen los puntos con cuentas falsas.
 *
 * Los puntos son un libro de movimientos (MovimientoPuntos): el saldo es
 * la suma. El SUPER_ADMIN canjea restando (p. ej. un mes de Pro gratis).
 */
@Injectable()
export class ReferidoService {
  private readonly logger = new Logger(ReferidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventos: EventEmitter2,
  ) {}

  private get puntosReferidor() {
    return Number(this.config.get('REFERIDO_PUNTOS')) || 100;
  }
  private get puntosBienvenida() {
    return Number(this.config.get('REFERIDO_PUNTOS_BIENVENIDA')) || 50;
  }

  /** Código del negocio; lo crea si no tiene. */
  async codigoDe(empresaId: number): Promise<string> {
    const existente = await this.prisma.codigoReferido.findUnique({ where: { empresaId } });
    if (existente) return existente.codigo;

    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    /* Legible y fácil de dictar: letras del nombre + 3 cifras, sin
       caracteres ambiguos. Se reintenta si choca con uno existente. */
    const base =
      empresa.nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .replace(/[IO]/g, '')
        .slice(0, 5) || 'BOOK';
    for (let intento = 0; intento < 8; intento++) {
      const codigo = `${base}${randomInt(100, 1000)}`;
      try {
        const creado = await this.prisma.codigoReferido.create({ data: { empresaId, codigo } });
        return creado.codigo;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const ganado = await this.prisma.codigoReferido.findUnique({ where: { empresaId } });
          if (ganado) return ganado.codigo; // otra petición lo creó a la vez
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('No se pudo generar un código de referido. Inténtalo de nuevo.');
  }

  /** Público: comprueba un código para el formulario de alta. */
  async validar(codigo: string) {
    const c = await this.prisma.codigoReferido.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: { empresa: { select: { nombre: true } } },
    });
    return c ? { valido: true as const, empresa: c.empresa.nombre } : { valido: false as const };
  }

  /** Vincula un negocio recién registrado con quien lo invitó. Best-effort. */
  async vincular(referidaId: number, codigo: string) {
    const c = await this.prisma.codigoReferido.findUnique({ where: { codigo: codigo.trim().toUpperCase() } });
    if (!c || c.empresaId === referidaId) return null;
    try {
      return await this.prisma.referido.create({
        data: { referidorId: c.empresaId, referidaId, codigo: c.codigo },
      });
    } catch (error) {
      // Ya estaba referido (referidaId es único): se ignora.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  /**
   * Al pagar un mes de Pro: si es el PRIMER pago del negocio y vino
   * referido, entrega los puntos a los dos. Idempotente.
   */
  async recompensarSiCorresponde(empresaId: number) {
    const referido = await this.prisma.referido.findUnique({ where: { referidaId: empresaId } });
    if (!referido || referido.estado !== EstadoReferido.PENDIENTE) return null;

    const pagados = await this.prisma.empresaPlanPago.count({
      where: { empresaId, estado: EstadoPagoPlan.PAGADO },
    });
    if (pagados !== 1) return null;

    const [puntosA, puntosB] = [this.puntosReferidor, this.puntosBienvenida];
    const actualizado = await this.prisma.$transaction(async (tx) => {
      // Solo una petición gana el paso PENDIENTE → RECOMPENSADO.
      const { count } = await tx.referido.updateMany({
        where: { id: referido.id, estado: EstadoReferido.PENDIENTE },
        data: {
          estado: EstadoReferido.RECOMPENSADO,
          puntosReferidor: puntosA,
          puntosReferida: puntosB,
          recompensadoEn: new Date(),
        },
      });
      if (count === 0) return null;
      await tx.movimientoPuntos.createMany({
        data: [
          { empresaId: referido.referidorId, puntos: puntosA, motivo: 'Referido: el negocio invitado pagó su primer mes de Pro', referidoId: referido.id },
          { empresaId: referido.referidaId, puntos: puntosB, motivo: 'Bienvenida por registrarte con un código de referido', referidoId: referido.id },
        ],
      });
      return tx.referido.findUnique({ where: { id: referido.id } });
    });

    if (actualizado) {
      this.eventos.emit(BOOKMY_EVENTS.REFERIDO_RECOMPENSADO, {
        empresaId: referido.referidorId,
        referidaId: referido.referidaId,
        puntos: puntosA,
      });
    }
    return actualizado;
  }

  async saldo(empresaId: number): Promise<number> {
    const r = await this.prisma.movimientoPuntos.aggregate({ where: { empresaId }, _sum: { puntos: true } });
    return r._sum.puntos ?? 0;
  }

  /** Vista del negocio: su código, saldo, a quién invitó y sus movimientos. */
  async mio(user: AuthenticatedUser) {
    const empresaId = user.empresaId;
    if (!empresaId) throw new ForbiddenException('Tu usuario no está asociado a ningún negocio.');

    const [codigo, saldo, referidos, movimientos] = await Promise.all([
      this.codigoDe(empresaId),
      this.saldo(empresaId),
      this.prisma.referido.findMany({
        where: { referidorId: empresaId },
        orderBy: { createdAt: 'desc' },
        include: { referida: { select: { nombre: true } } },
      }),
      this.prisma.movimientoPuntos.findMany({
        where: { empresaId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      codigo,
      saldo,
      puntosPorReferido: this.puntosReferidor,
      puntosBienvenida: this.puntosBienvenida,
      referidos: referidos.map((r) => ({
        id: r.id,
        empresa: r.referida.nombre,
        estado: r.estado,
        puntos: r.puntosReferidor,
        createdAt: r.createdAt,
        recompensadoEn: r.recompensadoEn,
      })),
      movimientos,
    };
  }

  /** Panel del SUPER_ADMIN: resumen, ranking y últimos referidos. */
  async admin() {
    const [codigos, total, recompensados, emitidos, canjeados, referidos, ranking] = await Promise.all([
      this.prisma.codigoReferido.count(),
      this.prisma.referido.count(),
      this.prisma.referido.count({ where: { estado: EstadoReferido.RECOMPENSADO } }),
      this.prisma.movimientoPuntos.aggregate({ where: { puntos: { gt: 0 } }, _sum: { puntos: true } }),
      this.prisma.movimientoPuntos.aggregate({ where: { puntos: { lt: 0 } }, _sum: { puntos: true } }),
      this.prisma.referido.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          referidor: { select: { id: true, nombre: true } },
          referida: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.codigoReferido.findMany({
        include: {
          empresa: {
            select: {
              id: true,
              nombre: true,
              referidosHechos: { select: { estado: true } },
              movimientosPuntos: { select: { puntos: true } },
            },
          },
        },
      }),
    ]);

    return {
      resumen: {
        codigos,
        referidos: total,
        recompensados,
        puntosEmitidos: emitidos._sum.puntos ?? 0,
        puntosCanjeados: Math.abs(canjeados._sum.puntos ?? 0),
      },
      ranking: ranking
        .map((c) => ({
          empresaId: c.empresa.id,
          empresa: c.empresa.nombre,
          codigo: c.codigo,
          referidos: c.empresa.referidosHechos.length,
          recompensados: c.empresa.referidosHechos.filter((r) => r.estado === EstadoReferido.RECOMPENSADO).length,
          saldo: c.empresa.movimientosPuntos.reduce((a, m) => a + m.puntos, 0),
        }))
        .sort((a, b) => b.recompensados - a.recompensados || b.referidos - a.referidos)
        .slice(0, 50),
      referidos: referidos.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        referidor: r.referidor,
        referida: r.referida,
        estado: r.estado,
        puntosReferidor: r.puntosReferidor,
        puntosReferida: r.puntosReferida,
        createdAt: r.createdAt,
        recompensadoEn: r.recompensadoEn,
      })),
    };
  }

  /**
   * Canje o ajuste manual (SUPER_ADMIN). Negativo = canje; no deja el
   * saldo por debajo de cero.
   */
  async movimiento(dto: { empresaId: number; puntos: number; motivo: string }, user: AuthenticatedUser) {
    if (!Number.isInteger(dto.puntos) || dto.puntos === 0) {
      throw new BadRequestException('Los puntos deben ser un número entero distinto de cero.');
    }
    const empresa = await this.prisma.empresa.findUnique({ where: { id: dto.empresaId }, select: { id: true } });
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    if (dto.puntos < 0) {
      const saldo = await this.saldo(dto.empresaId);
      if (saldo + dto.puntos < 0) {
        throw new BadRequestException(`Saldo insuficiente: tiene ${saldo} puntos.`);
      }
    }
    return this.prisma.movimientoPuntos.create({
      data: { empresaId: dto.empresaId, puntos: dto.puntos, motivo: dto.motivo.trim(), creadoPorId: user.userId },
    });
  }

  /** Anula un referido pendiente (fraude, duplicado…). */
  async anular(id: number) {
    const r = await this.prisma.referido.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('El referido no existe.');
    if (r.estado !== EstadoReferido.PENDIENTE) {
      throw new BadRequestException('Solo se puede anular un referido pendiente.');
    }
    return this.prisma.referido.update({ where: { id }, data: { estado: EstadoReferido.ANULADO } });
  }

  /** Log de error uniforme para los listeners. */
  registrarError(contexto: string, error: unknown) {
    this.logger.error(`${contexto}: ${error instanceof Error ? error.message : error}`);
  }
}
