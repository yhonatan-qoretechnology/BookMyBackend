import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EstadoPagoPlan } from '@prisma/client';
import { BOOKMY_EVENTS } from '../../common/events/event-names';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearEmpresaPlanPagoDto } from './dto/crear-empresa-plan-pago.dto';

/**
 * Pago manual de Bookmy CRM Pro: no existe cobro recurrente real todavía
 * (ver PlanService, PRO_SE_OFRECE), así que el SUPER_ADMIN carga cada
 * vencimiento a mano y EmpresaPlanPagoCron avisa cuando se pasa la fecha.
 * "Pagado" es el único evento de "esta empresa le pagó a Bookmy" que va a
 * existir en el sistema — de ahí se engancha la recompensa de referidos.
 */
@Injectable()
export class EmpresaPlanPagoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async crear(empresaId: number, dto: CrearEmpresaPlanPagoDto, creadoPorId?: number) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('La empresa no existe.');

    return this.prisma.empresaPlanPago.create({
      data: {
        empresaId,
        monto: dto.monto,
        vence: new Date(dto.vence),
        creadoPorId,
      },
    });
  }

  async listarDeEmpresa(empresaId: number) {
    return this.prisma.empresaPlanPago.findMany({
      where: { empresaId },
      orderBy: { vence: 'desc' },
    });
  }

  async listarTodas(filtros: { estado?: EstadoPagoPlan; page?: number; limit?: number } = {}) {
    const page = filtros.page && filtros.page > 0 ? filtros.page : 1;
    const limit = filtros.limit && filtros.limit > 0 ? Math.min(filtros.limit, 100) : 25;

    const where = filtros.estado ? { estado: filtros.estado } : {};

    const [items, total] = await Promise.all([
      this.prisma.empresaPlanPago.findMany({
        where,
        orderBy: { vence: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { empresa: { select: { id: true, nombre: true } } },
      }),
      this.prisma.empresaPlanPago.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** Resumen para las tarjetas del panel. */
  async resumen() {
    const [pendientes, vencidas, pagadasEsteMes] = await Promise.all([
      this.prisma.empresaPlanPago.count({ where: { estado: EstadoPagoPlan.PENDIENTE } }),
      this.prisma.empresaPlanPago.count({ where: { estado: EstadoPagoPlan.VENCIDO } }),
      this.prisma.empresaPlanPago.count({
        where: {
          estado: EstadoPagoPlan.PAGADO,
          pagadoEn: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);
    return { pendientes, vencidas, pagadasEsteMes };
  }

  /**
   * Marca un pago como pagado y emite `plan-pago.pagado` — el engranaje
   * que, en el pase 2, acredita la recompensa de referidos si es el
   * primer pago de esta empresa y tiene quien la haya referido.
   */
  async marcarPagado(pagoId: number) {
    const pago = await this.prisma.empresaPlanPago.findUnique({ where: { id: pagoId } });
    if (!pago) throw new NotFoundException('El pago no existe.');

    const actualizado = await this.prisma.empresaPlanPago.update({
      where: { id: pagoId },
      data: { estado: EstadoPagoPlan.PAGADO, pagadoEn: new Date() },
    });

    this.eventEmitter.emit(BOOKMY_EVENTS.PLAN_PAGO_PAGADO, {
      empresaId: actualizado.empresaId,
      monto: actualizado.monto,
      pagoId: actualizado.id,
    });

    return actualizado;
  }
}
