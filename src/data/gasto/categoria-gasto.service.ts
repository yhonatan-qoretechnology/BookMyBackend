import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

  async create(dto: CreateCategoriaGastoDto, user: AuthenticatedUser) {
    try {
      return await this.prisma.categoriaGasto.create({
        data: {
          nombre: dto.nombre,
          empresaId: user.empresaId ?? null,
          isBase: false,
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

    if (categoria.isBase) {
      throw new ForbiddenException('No se pueden eliminar las categorías base.');
    }

    if (categoria.empresaId !== (user.empresaId ?? null)) {
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
