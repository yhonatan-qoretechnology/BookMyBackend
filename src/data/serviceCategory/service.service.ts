import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from '../serviceCategory/dto/create-service.dto';
import { LanguageCode } from './dto/service-translation.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createServiceDto: CreateServiceDto) {
    // Validar que exista la categoría
    const categoryExists = await this.prisma.category.findUnique({
      where: { id: createServiceDto.categoryId },
    });

    if (!categoryExists) {
      throw new NotFoundException(
        `La categoría con ID ${createServiceDto.categoryId} no existe`,
      );
    }

    // Validar traducciones (requiere al menos español e inglés)
    const languages = createServiceDto.translations.map((t) => t.language);
    if (
      !languages.includes(LanguageCode.ES) ||
      !languages.includes(LanguageCode.EN)
    ) {
      throw new BadRequestException(
        'El servicio requiere traducciones en español (es) e inglés (en)',
      );
    }

    // Validar precios
    if (createServiceDto.prices.length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un precio para el servicio',
      );
    }

    return this.prisma.service.create({
      data: {
        categoryId: createServiceDto.categoryId,
        translations: {
          createMany: {
            data: createServiceDto.translations,
          },
        },
        prices: {
          createMany: {
            data: createServiceDto.prices.map((price) => ({
              amount: price.amount,
              duration: price.duration,
              currency: price.currency || 'EUR', // EUR por defecto
            })),
          },
        },
      },
      include: {
        translations: true,
        prices: true,
        category: {
          include: {
            translations: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        translations: true,
        prices: true,
        category: {
          include: {
            translations: {
              where: { language: 'es' }, // Traducción en español por defecto
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    return service;
  }

  async findAll(language: string = 'es') {
    return this.prisma.service.findMany({
      include: {
        translations: {
          where: { language },
        },
        prices: true,
        category: {
          include: {
            translations: {
              where: { language },
            },
          },
        },
      },
    });
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {
    const existingService = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Actualizar traducciones si se proporcionan
      if (updateServiceDto.translations) {
        await tx.serviceTranslation.deleteMany({
          where: { serviceId: id },
        });

        // Crear nuevas traducciones con serviceId incluido
        await tx.serviceTranslation.createMany({
          data: updateServiceDto.translations.map((t) => ({
            serviceId: id, // ¡Campo requerido añadido aquí!
            language: t.language as string,
            name: t.name as string,
            description: t.description,
          })),
        });
      }

      // Actualizar precios si se proporcionan
      if (updateServiceDto.prices) {
        await tx.price.deleteMany({
          where: { serviceId: id },
        });

        await tx.price.createMany({
          data: updateServiceDto.prices.map((p) => ({
            serviceId: id, // También requerido para precios
            amount: p.amount as number,
            duration: p.duration as number,
            currency: p.currency || 'EUR',
          })),
        });
      }

      return tx.service.update({
        where: { id },
        data: {
          categoryId: updateServiceDto.categoryId ?? existingService.categoryId,
        },
        include: {
          translations: true,
          prices: true,
        },
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceTranslation.deleteMany({
        where: { serviceId: id },
      });

      await tx.price.deleteMany({
        where: { serviceId: id },
      });

      return tx.service.delete({
        where: { id },
      });
    });
  }

  async findByCategory(categoryId: number, language: string = 'es') {
    return this.prisma.service.findMany({
      where: { categoryId },
      include: {
        translations: {
          where: { language },
        },
        prices: true,
      },
    });
  }
}
