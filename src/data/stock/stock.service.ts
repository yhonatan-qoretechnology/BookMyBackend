import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoSolicitud, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';

/**
 * Stock e insumos.
 *
 * El catálogo es de cada EMPRESA —una peluquería y una clínica no gastan
 * lo mismo— y las existencias son de cada SEDE, que es donde de verdad se
 * acaba el bote. Todo empieza vacío y en cero: un negocio recién creado no
 * tiene nada hasta que lo da de alta.
 *
 * Todo va acotado por empresa desde el primer día. Es un módulo nuevo y no
 * tiene por qué repetir la historia de reseñas o del equipo, donde el
 * aislamiento llegó después.
 */
@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  /**
   * La empresa con la que trabaja esta sesión. El superadmin tiene que
   * decir cuál, porque no es de ninguna.
   */
  private empresaDe(user: AuthenticatedUser | undefined, empresaId?: number): number {
    if (user?.role === Role.SUPER_ADMIN) {
      if (!empresaId) {
        throw new BadRequestException(
          'Indica de qué empresa es el inventario (empresaId).',
        );
      }
      return empresaId;
    }
    if (!user?.empresaId) {
      throw new ForbiddenException('Tu sesión no pertenece a ningún negocio.');
    }
    /* Pedir otra empresa desde una sesión de negocio es un intento de
       mirar el inventario ajeno: se ignora y manda la suya. */
    return user.empresaId;
  }

  /** Comprueba que una sede es de esa empresa antes de tocar su stock. */
  private async exigirSedeDeEmpresa(sedeId: number, empresaId: number) {
    const sede = await this.prisma.sede.findFirst({
      where: { id: sedeId, empresaId },
      select: { id: true },
    });
    if (!sede) {
      throw new NotFoundException('Esa sede no es de este negocio.');
    }
  }

  /* ── Catálogo ─────────────────────────────────────────── */

  async listarInsumos(user: AuthenticatedUser, empresaId?: number, incluirArchivados = false) {
    return this.prisma.insumo.findMany({
      where: {
        empresaId: this.empresaDe(user, empresaId),
        ...(incluirArchivados ? {} : { activo: true }),
      },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crearInsumo(
    user: AuthenticatedUser,
    datos: {
      nombre: string;
      categoria?: string;
      unidad?: string;
      precioRef?: number;
      empresaId?: number;
    },
  ) {
    const empresaId = this.empresaDe(user, datos.empresaId);
    const nombre = datos.nombre?.trim();
    if (!nombre) throw new BadRequestException('El insumo necesita un nombre.');

    try {
      return await this.prisma.insumo.create({
        data: {
          empresaId,
          nombre,
          categoria: datos.categoria?.trim() || 'General',
          unidad: datos.unidad?.trim() || 'ud',
          precioRef: datos.precioRef ?? 0,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(`Ya tienes un insumo llamado "${nombre}".`);
      }
      throw error;
    }
  }

  async actualizarInsumo(
    user: AuthenticatedUser,
    id: number,
    datos: {
      nombre?: string;
      categoria?: string;
      unidad?: string;
      precioRef?: number;
      activo?: boolean;
      empresaId?: number;
    },
  ) {
    const empresaId = this.empresaDe(user, datos.empresaId);
    const insumo = await this.prisma.insumo.findFirst({
      where: { id, empresaId },
      select: { id: true },
    });
    if (!insumo) throw new NotFoundException('Ese insumo no es de este negocio.');

    return this.prisma.insumo.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
        ...(datos.categoria !== undefined ? { categoria: datos.categoria.trim() } : {}),
        ...(datos.unidad !== undefined ? { unidad: datos.unidad.trim() } : {}),
        ...(datos.precioRef !== undefined ? { precioRef: datos.precioRef } : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      },
    });
  }

  /**
   * Archiva un insumo en vez de borrarlo: las solicitudes antiguas lo
   * citan y borrarlo dejaría el historial del negocio con huecos.
   */
  async archivarInsumo(user: AuthenticatedUser, id: number, empresaId?: number) {
    return this.actualizarInsumo(user, id, { activo: false, empresaId });
  }

  /* ── Existencias por sede ─────────────────────────────── */

  /**
   * Lo que hay en una sede. Devuelve TODOS los insumos del catálogo, no
   * solo los que tienen fila: un insumo del que nunca se ha comprado nada
   * está a cero, no es que no exista.
   */
  async stockDeSede(user: AuthenticatedUser, sedeId: number, empresaId?: number) {
    const empresa = this.empresaDe(user, empresaId);
    await this.exigirSedeDeEmpresa(sedeId, empresa);

    const [insumos, existencias] = await Promise.all([
      this.prisma.insumo.findMany({
        where: { empresaId: empresa, activo: true },
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.stockSede.findMany({ where: { sedeId } }),
    ]);

    const porInsumo = new Map(existencias.map((e) => [e.insumoId, e]));
    return insumos.map((insumo) => {
      const e = porInsumo.get(insumo.id);
      return {
        sedeId,
        insumoId: insumo.id,
        insumo,
        stock: e?.stock ?? 0,
        max: e?.max ?? 0,
      };
    });
  }

  /** Ajusta las existencias de un insumo en una sede. */
  async ajustarStock(
    user: AuthenticatedUser,
    sedeId: number,
    insumoId: number,
    datos: { stock?: number; max?: number; empresaId?: number },
  ) {
    const empresa = this.empresaDe(user, datos.empresaId);
    await this.exigirSedeDeEmpresa(sedeId, empresa);

    const insumo = await this.prisma.insumo.findFirst({
      where: { id: insumoId, empresaId: empresa },
      select: { id: true },
    });
    if (!insumo) throw new NotFoundException('Ese insumo no es de este negocio.');

    if ((datos.stock ?? 0) < 0 || (datos.max ?? 0) < 0) {
      throw new BadRequestException('Las cantidades no pueden ser negativas.');
    }

    return this.prisma.stockSede.upsert({
      where: { sedeId_insumoId: { sedeId, insumoId } },
      update: {
        ...(datos.stock !== undefined ? { stock: datos.stock } : {}),
        ...(datos.max !== undefined ? { max: datos.max } : {}),
      },
      create: {
        sedeId,
        insumoId,
        stock: datos.stock ?? 0,
        max: datos.max ?? 0,
      },
    });
  }

  /* ── Solicitudes de reposición ────────────────────────── */

  async listarSolicitudes(user: AuthenticatedUser, empresaId?: number, sedeId?: number) {
    const empresa = this.empresaDe(user, empresaId);
    if (sedeId) await this.exigirSedeDeEmpresa(sedeId, empresa);

    return this.prisma.solicitudInventario.findMany({
      where: {
        sede: { empresaId: empresa },
        ...(sedeId ? { sedeId } : {}),
      },
      include: {
        sede: { select: { id: true, nombre: true } },
        solicitante: {
          select: { id: true, email: true, UserData: { select: { name: true } } },
        },
        items: { include: { insumo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async crearSolicitud(
    user: AuthenticatedUser,
    datos: {
      sedeId: number;
      notas?: string;
      items: { insumoId: number; cantidad: number }[];
      empresaId?: number;
    },
  ) {
    const empresa = this.empresaDe(user, datos.empresaId);
    await this.exigirSedeDeEmpresa(datos.sedeId, empresa);

    const items = (datos.items ?? []).filter((i) => i.cantidad > 0);
    if (!items.length) {
      throw new BadRequestException('Añade al menos un insumo con cantidad.');
    }

    /* Que todos los insumos pedidos sean del catálogo de esta empresa:
       si no, se podrían colar ids de otro negocio en el pedido. */
    const validos = await this.prisma.insumo.findMany({
      where: { id: { in: items.map((i) => i.insumoId) }, empresaId: empresa },
      select: { id: true },
    });
    if (validos.length !== items.length) {
      throw new BadRequestException('Alguno de los insumos no es de este negocio.');
    }

    return this.prisma.solicitudInventario.create({
      data: {
        sedeId: datos.sedeId,
        solicitanteId: user.userId ?? null,
        notas: datos.notas?.trim() || null,
        items: { create: items },
      },
      include: { items: { include: { insumo: true } } },
    });
  }

  /**
   * Aprueba o rechaza un pedido. Al aprobarlo se suman las cantidades a
   * las existencias de la sede: es el momento en el que el material entra
   * de verdad.
   */
  async resolverSolicitud(
    user: AuthenticatedUser,
    id: number,
    estado: EstadoSolicitud,
    empresaId?: number,
  ) {
    const empresa = this.empresaDe(user, empresaId);
    const solicitud = await this.prisma.solicitudInventario.findFirst({
      where: { id, sede: { empresaId: empresa } },
      include: { items: true },
    });
    if (!solicitud) throw new NotFoundException('Esa solicitud no es de este negocio.');
    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException('Esa solicitud ya estaba resuelta.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (estado === EstadoSolicitud.APROBADA) {
        for (const item of solicitud.items) {
          await tx.stockSede.upsert({
            where: {
              sedeId_insumoId: { sedeId: solicitud.sedeId, insumoId: item.insumoId },
            },
            update: { stock: { increment: item.cantidad } },
            create: {
              sedeId: solicitud.sedeId,
              insumoId: item.insumoId,
              stock: item.cantidad,
              max: 0,
            },
          });
        }
      }

      return tx.solicitudInventario.update({
        where: { id },
        data: { estado, resueltaEn: new Date() },
        include: { items: { include: { insumo: true } } },
      });
    });
  }
}
