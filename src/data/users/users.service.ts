import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guarda (reemplaza) las categorías seleccionadas por el usuario.
   * Usa la tabla puente UserCategory (user_category).
   */
  async saveSelectedCategories(userId: number, categoryIds: number[]) {
    // Verificar que el usuario exista
    const userExists = await this.prisma.users.count({ where: { id: userId } });
    if (userExists === 0) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    const uniqueCategoryIds = [...new Set(categoryIds)];
    if (uniqueCategoryIds.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos una categoría.');
    }

    // Validar que las categorías existan
    const foundCategories = await this.prisma.category.findMany({
      where: { id: { in: uniqueCategoryIds } },
      select: { id: true },
    });

    if (foundCategories.length !== uniqueCategoryIds.length) {
      const existingIds = new Set(foundCategories.map((c) => c.id));
      const missingIds = uniqueCategoryIds.filter((id) => !existingIds.has(id));
      throw new BadRequestException(
        `Las siguientes categorías no se encontraron: ${missingIds.join(', ')}.`,
      );
    }

    // Transacción: borrar anteriores y crear nuevas
    await this.prisma.$transaction(async (tx) => {
      await tx.userCategory.deleteMany({ where: { userId } });

      await tx.userCategory.createMany({
        data: uniqueCategoryIds.map((categoryId) => ({ userId, categoryId })),
        skipDuplicates: true,
      });
    });

    return {
      message: 'Categorías seleccionadas guardadas correctamente.',
      count: uniqueCategoryIds.length,
    };
  }
}
