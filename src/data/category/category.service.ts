import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva categoría con sus traducciones
   */
  async create(createCategoryDto: CreateCategoryDto) {
    // Validar idiomas únicos
    const languages = createCategoryDto.translations.map((t) => t.language);
    if (new Set(languages).size !== languages.length) {
      throw new BadRequestException(
        'No se permiten idiomas duplicados en las traducciones',
      );
    }

    try {
      return await this.prisma.category.create({
        data: {
          translations: {
            createMany: {
              data: createCategoryDto.translations.map((t) => ({
                language: t.language,
                name: t.name,
                description: t.description,
              })),
            },
          },
        },
        include: { translations: true },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  /**
   * Obtiene todas las categorías filtradas por idioma (default: 'es')
   */
  async findAll(language: string = 'es') {
    const categories = await this.prisma.category.findMany({
      include: {
        translations: {
          where: { language },
        },
      },
    });

    return categories.filter((c) => c.translations.length > 0);
  }

  /**
   * Obtiene una categoría por ID e idioma
   */
  async findOne(id: number, language: string = 'es') {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        translations: {
          where: { language },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return category;
  }

  /**
   * Actualiza una categoría y sus traducciones
   */
  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    // Validar que existan traducciones
    if (!updateCategoryDto.translations?.length) {
      throw new BadRequestException('Se requiere al menos una traducción');
    }

    // Verificar que la categoría existe
    await this.findOne(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Eliminar traducciones existentes
        await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });

        // 2. Crear nuevas traducciones
        return await tx.category.update({
          where: { id },
          data: {
            translations: {
              createMany: {
                data: updateCategoryDto.translations.map((t) => ({
                  language: t.language,
                  name: t.name,
                  description: t.description,
                })),
              },
            },
          },
          include: { translations: true },
        });
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  /**
   * Elimina una categoría
   */
  async remove(id: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Primero eliminar las traducciones
      await tx.categoryTranslation.deleteMany({
        where: { categoryId: id },
      });

      // 2. Luego eliminar la categoría
      return await tx.category.delete({
        where: { id },
      });
    });
  }

  /**
   * Maneja errores específicos de Prisma
   */
  private handlePrismaError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new BadRequestException(
            'Ya existe una traducción para este idioma',
          );
        case 'P2025':
          throw new NotFoundException('Registro no encontrado');
        default:
          throw new BadRequestException(`Error de Prisma: ${error.code}`);
      }
    }
    throw error; // Re-lanza errores no manejados
  }
}
