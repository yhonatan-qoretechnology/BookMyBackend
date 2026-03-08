import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private moveCategoryFileToFinalPath(file: Express.Multer.File) {
    const uploadDirAbs = path.join(process.cwd(), 'uploads', 'categories');
    if (!fs.existsSync(uploadDirAbs)) {
      fs.mkdirSync(uploadDirAbs, { recursive: true });
    }

    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const finalAbsPath = path.join(uploadDirAbs, finalFileName);

    const tempAbsPath = path.isAbsolute(file.path)
      ? file.path
      : path.join(process.cwd(), file.path);

    if (tempAbsPath !== finalAbsPath) {
      fs.renameSync(tempAbsPath, finalAbsPath);
    }

    return path
      .join('uploads', 'categories', finalFileName)
      .replace(/\\/g, '/');
  }

  private safeDeleteCategoryFile(filePath: string) {
    if (!filePath) return;
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (error) {
        console.error(
          `Error al eliminar archivo de categoría: ${absPath}`,
          error,
        );
      }
    }
  }

  /**
   * Crea una nueva categoría con traducciones e imagen opcional
   */
  async create(
    createCategoryDto: CreateCategoryDto,
    file?: Express.Multer.File,
  ) {
    const languages = createCategoryDto.translations.map((t) => t.language);
    if (new Set(languages).size !== languages.length) {
      if (file) this.safeDeleteCategoryFile(file.path);
      throw new BadRequestException(
        'No se permiten idiomas duplicados en las traducciones',
      );
    }

    let imagePath: string | null = null;
    if (file) {
      imagePath = this.moveCategoryFileToFinalPath(file);
    }

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
      if (file) this.safeDeleteCategoryFile(imagePath || file.path);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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

  async findThenRandom(language: string = 'es') {
    // Obtener todas las categorías con traducciones en el idioma solicitado
    const categories = await this.prisma.category.findMany({
      include: {
        translations: { where: { language } },
      },
    });

    // Filtrar categorías que tengan traducciones válidas
    const filtered = categories.filter((c) => c.translations.length > 0);

    // Mezclar aleatoriamente (Fisher-Yates shuffle)
    const shuffled = filtered.sort(() => Math.random() - 0.5);

    // Limitar a 10 resultados
    return shuffled.slice(0, 10);
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
      if (file) this.safeDeleteCategoryFile(file.path);
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }

    let imagePath = category.image;
    if (file) {
      imagePath = this.moveCategoryFileToFinalPath(file);
    }

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
        if (file && category.image && category.image !== imagePath) {
          this.safeDeleteCategoryFile(category.image);
        }

        return updated;
      });
    } catch (error) {
      if (file) this.safeDeleteCategoryFile(imagePath || file.path);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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
      this.safeDeleteCategoryFile(category.image);
    }

    await this.prisma.categoryTranslation.deleteMany({
      where: { categoryId: id },
    });
    await this.prisma.category.delete({ where: { id } });

    return { message: `Categoría con ID ${id} eliminada correctamente.` };
  }

  async updateImage(id: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe subir una imagen válida.');
    }

    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      this.safeDeleteCategoryFile(file.path);
      throw new NotFoundException(`Categoría con ID ${id} no encontrada.`);
    }

    const newImagePath = this.moveCategoryFileToFinalPath(file);

    try {
      // ✅ Eliminar imagen anterior (si existe)
      if (category.image) {
        this.safeDeleteCategoryFile(category.image);
      }

      const updated = await this.prisma.category.update({
        where: { id },
        data: { image: newImagePath },
      });

      return updated;
    } catch (error) {
      this.safeDeleteCategoryFile(newImagePath);
      throw error;
    }
  }
}
