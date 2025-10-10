import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceDto } from '../serviceCategory/dto/create-service.dto';
import { UpdateServiceDto } from '../serviceCategory/dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  // 🟢 Crear servicio con traducciones, precios y sedes opcionales
  async create(dto: CreateServiceDto) {
    return this.prisma.$transaction(async (tx) => {
      // Verificar categoría
      const category = await tx.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('La categoría especificada no existe');
      }

      // Verificar sedes (si se envían)
      let sedeConnect:
        | Prisma.SedeCreateNestedManyWithoutServiceInput
        | undefined;
      if (dto.sedeIds?.length) {
        const sedes = await tx.sede.findMany({
          where: { id: { in: dto.sedeIds } },
        });
        if (sedes.length !== dto.sedeIds.length) {
          throw new NotFoundException('Una o más sedes no existen');
        }

        sedeConnect = {
          connect: dto.sedeIds.map((id) => ({ id })),
        };
      }

      // Crear el servicio base
      const service = await tx.service.create({
        data: {
          categoryId: dto.categoryId,
          sedes: sedeConnect,
        },
      });

      // Crear traducciones
      await tx.serviceTranslation.createMany({
        data: dto.translations.map((t) => ({
          serviceId: service.id,
          language: t.language as string,
          name: t.name!,
          description: t.description ?? '',
        })),
      });

      // Crear precios
      await tx.price.createMany({
        data: dto.prices.map((p) => ({
          serviceId: service.id,
          amount: p.amount!,
          duration: p.duration!,
          currency: p.currency || 'EUR',
        })),
      });

      // Retornar el servicio completo con sus relaciones
      return tx.service.findUnique({
        where: { id: service.id },
        include: {
          translations: true,
          prices: true,
          sedes: true,
        },
      });
    });
  }

  // 🟡 Actualizar servicio
  async update(id: number, dto: UpdateServiceDto) {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException('El servicio no existe');
    }

    return this.prisma.$transaction(async (tx) => {
      // Actualizar traducciones si se envían
      if (dto.translations) {
        await tx.serviceTranslation.deleteMany({ where: { serviceId: id } });
        await tx.serviceTranslation.createMany({
          data: dto.translations.map((t) => ({
            serviceId: id,
            language: t.language as string,
            name: t.name!,
            description: t.description ?? '',
          })),
        });
      }

      // Actualizar precios si se envían
      if (dto.prices) {
        await tx.price.deleteMany({ where: { serviceId: id } });
        await tx.price.createMany({
          data: dto.prices.map((p) => ({
            serviceId: id,
            amount: p.amount!,
            duration: p.duration!,
            currency: p.currency || 'EUR',
          })),
        });
      }

      // Actualizar relación con sedes
      let sedeConnect:
        | Prisma.SedeUpdateManyWithoutServiceNestedInput
        | undefined;
      if (dto.sedeIds) {
        const sedes = await tx.sede.findMany({
          where: { id: { in: dto.sedeIds } },
        });

        if (sedes.length !== dto.sedeIds.length) {
          throw new NotFoundException('Una o más sedes no existen');
        }

        sedeConnect = {
          set: dto.sedeIds.map((id) => ({ id })), // reemplaza todas las sedes previas
        };
      }

      // Actualizar datos del servicio
      return tx.service.update({
        where: { id },
        data: {
          categoryId: dto.categoryId ?? existing.categoryId,
          ...(sedeConnect && { sedes: sedeConnect }),
        },
        include: {
          translations: true,
          prices: true,
          sedes: true,
        },
      });
    });
  }

  // 🟠 Obtener un servicio por ID
  async findOne(id: number, language: string = 'es') {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        translations: {
          where: { language },
          take: 1,
        },
        prices: true,
        sedes: true,
        category: {
          include: { translations: { where: { language }, take: 1 } },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  // 🔵 Listar todos los servicios (con traducción según idioma)
  async findAll(language: string = 'es') {
    const services = await this.prisma.service.findMany({
      include: {
        translations: {
          where: { language },
          take: 1,
        },
        prices: true,
        sedes: true,
        category: true,
      },
    });

    return services.map((service) => ({
      id: service.id,
      name: service.translations[0]?.name ?? 'Sin traducción',
      description: service.translations[0]?.description ?? '',
      prices: service.prices,
      sedes: service.sedes,
    }));
  }

  // 🔴 Eliminar servicio y dependencias
  async remove(id: number) {
    const existing = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceTranslation.deleteMany({ where: { serviceId: id } });
      await tx.price.deleteMany({ where: { serviceId: id } });
      return tx.service.delete({ where: { id } });
    });
  }
}
