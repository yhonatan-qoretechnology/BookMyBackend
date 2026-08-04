import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoriaGastoDto } from './dto/create-categoria-gasto.dto';

@Injectable()
export class CategoriaGastoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.categoriaGasto.findMany({
      where: {
        OR: [{ isBase: true }, { empresaId: user.empresaId ?? null }],
      },
      orderBy: [{ isBase: 'desc' }, { nombre: 'asc' }],
    });
  }

  /**
   * Crea una categoría de gasto.
   *
   * Un SUPER_ADMIN no pertenece a ninguna empresa, así que sus
   * categorías se crean como base (empresaId null, isBase true) y
   * quedan disponibles para toda la plataforma. El resto de roles
   * crean categorías propias de su empresa.
   */
  async create(dto: CreateCategoriaGastoDto, user: AuthenticatedUser) {
    const esPlataforma = user.role === Role.SUPER_ADMIN && !user.empresaId;

    if (!esPlataforma && !user.empresaId) {
      throw new ForbiddenException(
        'No tiene una empresa asociada para crear categorías propias.',
      );
    }

    /* El índice @@unique([empresaId, nombre]) no protege a las base:
       en PostgreSQL dos NULL se consideran distintos, así que el
       duplicado hay que detectarlo aquí. */
    const duplicada = await this.prisma.categoriaGasto.findFirst({
      where: {
        nombre: { equals: dto.nombre, mode: 'insensitive' },
        empresaId: esPlataforma ? null : user.empresaId,
      },
      select: { id: true },
    });

    if (duplicada) {
      throw new BadRequestException(
        esPlataforma
          ? 'Ya existe una categoría base con ese nombre.'
          : 'Ya existe una categoría con ese nombre en su empresa.',
      );
    }

    try {
      return await this.prisma.categoriaGasto.create({
        data: {
          nombre: dto.nombre,
          empresaId: esPlataforma ? null : user.empresaId,
          isBase: esPlataforma,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Ya existe una categoría con ese nombre en su empresa.',
        );
      }
      throw error;
    }
  }

  async remove(id: number, user: AuthenticatedUser) {
    const categoria = await this.prisma.categoriaGasto.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada.');
    }

    /* Las categorías base son de la plataforma: solo el SUPER_ADMIN,
       que es quien puede crearlas, puede retirarlas. */
    if (categoria.isBase) {
      if (user.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'No se pueden eliminar las categorías base.',
        );
      }
    } else if (!user.empresaId || categoria.empresaId !== user.empresaId) {
      throw new ForbiddenException(
        'No puede eliminar categorías de otra empresa.',
      );
    }

    try {
      return await this.prisma.categoriaGasto.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'No se puede eliminar la categoría porque tiene gastos asociados.',
        );
      }
      throw error;
    }
  }
}
