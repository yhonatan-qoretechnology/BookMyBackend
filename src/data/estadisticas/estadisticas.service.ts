import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma, ViewEntityType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EntityViewService } from '../entity-view/entity-view.service';
import { QueryEstadisticasDto } from './dto/query-estadisticas.dto';

/**
 * Estados que cuentan como "reserva" en los rankings.
 *
 * Se excluyen canceladas y no-show a proposito: un ranking de "servicios mas
 * reservados" que incluya las canceladas premia justamente lo que no se llego
 * a prestar. El KPI de canceladas se mide aparte.
 */
const ESTADOS_VALIDOS: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
];

@Injectable()
export class EstadisticasService {
  constructor(
    private prisma: PrismaService,
    private readonly entityViews: EntityViewService,
  ) {}

  private rango(q: QueryEstadisticasDto) {
    return {
      desde: q.desde ? new Date(`${q.desde}T00:00:00.000Z`) : undefined,
      /* `hasta` es inclusivo para quien lo pide, asi que internamente se
         convierte en "menor que el dia siguiente". */
      hasta: q.hasta
        ? new Date(new Date(`${q.hasta}T00:00:00.000Z`).getTime() + 86400000)
        : undefined,
    };
  }

  private async sedesDelAlcance(q: QueryEstadisticasDto): Promise<number[] | undefined> {
    if (q.sedeId) return [q.sedeId];
    if (q.empresaId) {
      const sedes = await this.prisma.sede.findMany({
        where: { empresaId: q.empresaId },
        select: { id: true },
      });
      return sedes.map((s) => s.id);
    }
    return undefined;
  }

  private async whereCitas(q: QueryEstadisticasDto): Promise<Prisma.AppointmentWhereInput> {
    const { desde, hasta } = this.rango(q);
    const sedes = await this.sedesDelAlcance(q);
    return {
      estado: { in: ESTADOS_VALIDOS },
      ...(sedes ? { sedeId: { in: sedes } } : {}),
      ...(desde || hasta
        ? { horaInicio: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: hasta } : {}) } }
        : {}),
    };
  }

  /** 2.10 — servicios con mas reservas. */
  async serviciosConMasReservas(q: QueryEstadisticasDto) {
    const where = await this.whereCitas(q);
    const filas = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where,
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: q.limit ?? 10,
    });

    const servicios = await this.prisma.service.findMany({
      where: { id: { in: filas.map((f) => f.serviceId) } },
      include: { translations: true },
    });

    return filas.map((f) => {
      const s = servicios.find((x) => x.id === f.serviceId);
      return {
        id: f.serviceId,
        nombre: s?.translations?.[0]?.name ?? `#${f.serviceId}`,
        reservas: f._count.serviceId,
      };
    });
  }

  /**
   * 2.9 — empresas con mas reservas.
   *
   * Prisma no agrupa por un campo de una relacion, asi que se agrupa por sede
   * y se suma por empresa en memoria con el mapa sede -> empresa.
   */
  async empresasConMasReservas(q: QueryEstadisticasDto) {
    const where = await this.whereCitas(q);
    const porSede = await this.prisma.appointment.groupBy({
      by: ['sedeId'],
      where,
      _count: { sedeId: true },
    });

    const sedes = await this.prisma.sede.findMany({
      where: { id: { in: porSede.map((f) => f.sedeId) } },
      select: { id: true, empresaId: true, empresa: { select: { nombre: true } } },
    });

    const acumulado = new Map<number, { nombre: string; reservas: number }>();
    for (const fila of porSede) {
      const sede = sedes.find((s) => s.id === fila.sedeId);
      if (!sede) continue;
      const actual = acumulado.get(sede.empresaId) ?? {
        nombre: sede.empresa?.nombre ?? `#${sede.empresaId}`,
        reservas: 0,
      };
      actual.reservas += fila._count.sedeId;
      acumulado.set(sede.empresaId, actual);
    }

    return [...acumulado.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.reservas - a.reservas)
      .slice(0, q.limit ?? 10);
  }

  /** 2.15 — reservas e ingresos por empleado. */
  async empleados(q: QueryEstadisticasDto) {
    const where = await this.whereCitas(q);
    const filas = await this.prisma.appointment.groupBy({
      by: ['profesionalId'],
      where,
      _count: { profesionalId: true },
      orderBy: { _count: { profesionalId: 'desc' } },
      take: q.limit ?? 10,
    });

    const ids = filas.map((f) => f.profesionalId);
    const [profesionales, pagos] = await Promise.all([
      this.prisma.profesional.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true, imagen: true },
      }),
      this.prisma.payment.findMany({
        where: { appointment: { ...where, profesionalId: { in: ids } } },
        select: { totalAmount: true, appointment: { select: { profesionalId: true } } },
      }),
    ]);

    const ingresos = new Map<number, number>();
    for (const p of pagos) {
      const pid = p.appointment?.profesionalId;
      if (pid == null) continue;
      ingresos.set(pid, (ingresos.get(pid) ?? 0) + (p.totalAmount ?? 0));
    }

    return filas.map((f) => ({
      id: f.profesionalId,
      nombre: profesionales.find((p) => p.id === f.profesionalId)?.nombre ?? `#${f.profesionalId}`,
      imagen: profesionales.find((p) => p.id === f.profesionalId)?.imagen ?? null,
      reservas: f._count.profesionalId,
      ingresos: Number((ingresos.get(f.profesionalId) ?? 0).toFixed(2)),
    }));
  }

  /** 2.8 — ciudades con mas usuarios. Sale de user_locations, no de las vistas. */
  async ciudades(q: QueryEstadisticasDto) {
    const filas = await this.prisma.userLocation.groupBy({
      by: ['cityNormalized'],
      where: { cityNormalized: { not: null } },
      _count: { cityNormalized: true },
      orderBy: { _count: { cityNormalized: 'desc' } },
      take: q.limit ?? 10,
    });

    /* cityNormalized esta en minusculas para agrupar; el nombre bonito se
       recupera de una fila cualquiera de esa ciudad. */
    const nombres = await this.prisma.userLocation.findMany({
      where: { cityNormalized: { in: filas.map((f) => f.cityNormalized as string) } },
      select: { city: true, cityNormalized: true },
      distinct: ['cityNormalized'],
    });

    return filas.map((f) => ({
      ciudad:
        nombres.find((n) => n.cityNormalized === f.cityNormalized)?.city ??
        f.cityNormalized,
      usuarios: f._count.cityNormalized,
    }));
  }

  /** 2.2-2.5 y 2.7 — lo mas visto de cada tipo. */
  async masVistos(tipo: ViewEntityType, q: QueryEstadisticasDto) {
    const { desde, hasta } = this.rango(q);
    return this.entityViews.ranking({
      entityType: tipo,
      desde,
      hasta,
      empresaId: q.empresaId,
      sedeId: q.sedeId,
      limit: q.limit,
    });
  }
}
