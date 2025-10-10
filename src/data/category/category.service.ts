import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva categoría con traducciones e imagen opcional
   */
  async create(
    createCategoryDto: CreateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const languages = createCategoryDto.translations.map((t) => t.language);
    if (new Set(languages).size !== languages.length) {
      throw new BadRequestException(
        'No se permiten idiomas duplicados en las traducciones',
      );
    }

    const imagePath = file ? file.path : null;

    try {
      return await this.prisma.category.create({
        data: {
          image: imagePath,
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (file) fs.unlinkSync(file.path);
        throw new BadRequestException(
          'Ya existe una traducción para este idioma',
        );
      }
      throw error;
    }
  }

  /**
   * Obtiene todas las categorías por idioma
   */
  async findAll(language: string = 'es') {
    const categories = await this.prisma.category.findMany({
      include: {
        translations: { where: { language } },
      },
    });
    return categories.filter((c) => c.translations.length > 0);
  }

  /**
   * Obtiene una categoría por ID
   */
  async findOne(id: number, language: string = 'es') {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        translations: { where: { language } },
      },
    });
    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }
    return category;
  }

  /**
   * Actualiza una categoría con nueva imagen y traducciones
   */
  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      if (file) fs.unlinkSync(file.path);
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }

    const imagePath = file ? file.path : category.image;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });

        const updated = await tx.category.update({
          where: { id },
          data: {
            image: imagePath,
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

        // Si se subió una nueva imagen, eliminar la anterior
        if (file && category.image) {
          try {
            fs.unlinkSync(category.image);
          } catch (error) {
            console.error(
              `Error al eliminar imagen antigua: ${category.image}`,
              error,
            );
          }
        }

        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (file) fs.unlinkSync(file.path);
        throw new BadRequestException(
          'Ya existe una traducción para este idioma',
        );
      }
      throw error;
    }
  }

  /**
   * Elimina una categoría junto con su imagen y traducciones
   */
  async remove(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }

    if (category.image) {
      try {
        fs.unlinkSync(category.image);
      } catch (error) {
        console.error(`Error al eliminar imagen: ${category.image}`, error);
      }
    }

    await this.prisma.categoryTranslation.deleteMany({
      where: { categoryId: id },
    });
    await this.prisma.category.delete({ where: { id } });

    return { message: `Categoría con ID ${id} eliminada correctamente.` };
  }

  // 🔹 Actualizar solo la imagen de la categoría
  async updateImage(id: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe subir una imagen válida.');
    }

    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      // Elimina archivo si la categoría no existe
      fs.unlinkSync(file.path);
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }

    // Eliminar imagen anterior (si existe)
    if (category.image) {
      try {
        fs.unlinkSync(category.image);
      } catch (error) {
        console.warn(
          `⚠️ No se pudo eliminar la imagen anterior: ${category.image}`,
        );
      }
    }

    // Actualizar la nueva ruta de imagen
    return this.prisma.category.update({
      where: { id },
      data: { image: file.path },
    });
  }
}
