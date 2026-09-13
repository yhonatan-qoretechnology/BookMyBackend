import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ViewEntityType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEntityViewDto } from './dto/create-entity-view.dto';

/**
 * Registro de vistas del catalogo (estadisticas 2.2-2.5 y 2.7).
 *
 * Una sola tabla generica en vez de una por entidad: los rankings son la misma
 * consulta cambiando `entityType`.
 */
@Injectable()
export class EntityViewService {
  private readonly logger = new Logger(EntityViewService.name);

  /**
   * Ventana de deduplicacion. Sin esto, un usuario que recarga la ficha cinco
   * veces valdria por cinco visitas y el ranking mediria recargas, no interes.
   */
  private static readonly DEDUPE_MINUTOS = 30;

  constructor(private prisma: PrismaService) {}

  async registrar(dto: CreateEntityViewDto, userId?: number) {
    if (userId) {
      const desde = new Date(
        Date.now() - EntityViewService.DEDUPE_MINUTOS * 60 * 1000,
      );
      const reciente = await this.prisma.entityView.findFirst({
        where: {
          userId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          createdAt: { gte: desde },
        },
        select: { id: true },
      });
      if (reciente) return { registrada: false as const };
    }

    await this.prisma.entityView.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        userId: userId ?? null,
        empresaId: dto.empresaId ?? null,
        sedeId: dto.sedeId ?? null,
        city: dto.city ?? null,
      },
    });

    return { registrada: true as const };
  }

  /**
   * Ranking de lo mas visto de un tipo.
   *
   * Devuelve id y numero de vistas; el nombre lo resuelve quien llame, que es
   * el que sabe en que idioma pintarlo.
   */
  async ranking(params: {
    entityType: ViewEntityType;
    desde?: Date;
    hasta?: Date;
    empresaId?: number;
    sedeId?: number;
    limit?: number;
  }) {
    const where: Prisma.EntityViewWhereInput = {
      entityType: params.entityType,
      ...(params.empresaId ? { empresaId: params.empresaId } : {}),
      ...(params.sedeId ? { sedeId: params.sedeId } : {}),
      ...(params.desde || params.hasta
        ? {
            createdAt: {
              ...(params.desde ? { gte: params.desde } : {}),
              ...(params.hasta ? { lt: params.hasta } : {}),
            },
          }
        : {}),
    };

    const filas = await this.prisma.entityView.groupBy({
      by: ['entityId'],
      where,
      _count: { entityId: true },
      orderBy: { _count: { entityId: 'desc' } },
      take: params.limit ?? 10,
    });

    return filas.map((f) => ({
      entityId: f.entityId,
      vistas: f._count.entityId,
    }));
  }

  /** Ciudades con mas usuarios distintos (estadistica 2.8, via vistas). */
  async ciudades(params: { desde?: Date; hasta?: Date; limit?: number }) {
    const filas = await this.prisma.entityView.groupBy({
      by: ['city'],
      where: {
        city: { not: null },
        ...(params.desde || params.hasta
          ? {
              createdAt: {
                ...(params.desde ? { gte: params.desde } : {}),
                ...(params.hasta ? { lt: params.hasta } : {}),
              },
            }
          : {}),
      },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: params.limit ?? 10,
    });

    return filas.map((f) => ({ ciudad: f.city, vistas: f._count.city }));
  }
}
