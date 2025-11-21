import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client'; // Importa para manejar errores específicos de Prisma
import { PrismaService } from '../../prisma/prisma.service'; // Asegúrate de que esta ruta sea correcta
import { AddUserCategoriesDto } from './dto/add-user-categories.dto';

@Injectable()
export class UserCategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Actualiza las categorías seleccionadas por un usuario.
   * Elimina las relaciones existentes y crea nuevas.
   * @param userId El ID del usuario que realiza la operación.
   * @param dto El DTO que contiene los IDs de las categorías a asociar.
   * @returns Un mensaje de confirmación y el número de categorías asociadas.
   */
  async updateUserCategories(
    userId: number,
    dto: AddUserCategoriesDto,
  ): Promise<{ message: string; count: number }> {
    try {
      // Opcional: Verificar si el usuario existe (puede ser manejado por un guardia o middleware previo)
      const userExists = await this.prisma.users.count({
        where: { id: userId },
      });
      if (userExists === 0) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
      }

      // Validar que todas las categoryIds existen
      const uniqueCategoryIds = [...new Set(dto.categoryIds)]; // Eliminar duplicados en la entrada
      const foundCategories = await this.prisma.category.findMany({
        where: { id: { in: uniqueCategoryIds } },
        select: { id: true },
      });

      if (foundCategories.length !== uniqueCategoryIds.length) {
        const existingIds = new Set(foundCategories.map((c) => c.id));
        const missingIds = uniqueCategoryIds.filter(
          (id) => !existingIds.has(id),
        );
        throw new BadRequestException(
          `Las siguientes categorías no se encontraron: ${missingIds.join(', ')}.`,
        );
      }

      // Iniciar una transacción para asegurar la atomicidad de la operación
      await this.prisma.$transaction(async (tx) => {
        // 1. Eliminar todas las relaciones existentes para este usuario
        await tx.userCategory.deleteMany({
          where: { userId },
        });

        // 2. Crear las nuevas relaciones
        const userCategoryData = uniqueCategoryIds.map((categoryId) => ({
          userId,
          categoryId,
        }));

        await tx.userCategory.createMany({
          data: userCategoryData,
          skipDuplicates: true, // Esto ayuda en caso de reintentos o lógica compleja, aunque aquí no debería haber duplicados
        });
      });

      return {
        message: 'Categorías de usuario actualizadas exitosamente.',
        count: uniqueCategoryIds.length,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Puedes añadir manejo de errores específicos de Prisma aquí
        // Por ejemplo, error.code === 'P2003' para fallos de FK, aunque ya se validó antes
      }
      throw error; // Relanza el error para que sea capturado por los interceptores de NestJS
    }
  }

  /**
   * Obtiene las categorías seleccionadas por un usuario, incluyendo sus traducciones.
   * @param userId El ID del usuario.
   * @param lang El idioma deseado para las traducciones (ej. 'es', 'en').
   * @returns Un array con las categorías completas y sus traducciones filtradas por idioma.
   */
  async getUserCategories(userId: number, lang: string = 'es'): Promise<any[]> {
    // Verificar si el usuario existe antes de intentar buscar sus categorías
    const userExists = await this.prisma.users.count({ where: { id: userId } });
    if (userExists === 0) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    const userCategories = await this.prisma.userCategory.findMany({
      where: { userId },
      select: {
        category: {
          include: {
            translations: {
              where: { language: lang },
            },
          },
        },
      },
    });

    if (!userCategories || userCategories.length === 0) {
      return []; // Devuelve un array vacío si el usuario no tiene categorías seleccionadas
    }

    // Devolver las categorías completas, filtrando las que no tienen traducciones en el idioma solicitado
    return userCategories
      .map((uc) => uc.category)
      .filter((c) => c.translations && c.translations.length > 0);
  }
}
