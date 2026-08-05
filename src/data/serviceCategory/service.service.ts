import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateServiceDto } from '../serviceCategory/dto/create-service.dto';
import { UpdateServiceDto } from '../serviceCategory/dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
  ) {}

  // 🟢 Crear servicio con traducciones, precios y sedes opcionales
  async create(dto: CreateServiceDto, user?: AuthenticatedUser) {
    const sedeIds = dto.sedeIds ? [...dto.sedeIds] : [];

    if (user?.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId) {
        throw new ForbiddenException(
          'El administrador de sede no tiene una sede asociada.',
        );
      }
      if (sedeIds.length === 0) {
        sedeIds.push(user.sedeId);
      }
      const invalid = sedeIds.some((id) => id !== user.sedeId);
      if (invalid) {
        throw new ForbiddenException(
          'Solo puede asociar el servicio a su propia sede.',
        );
      }
    }

    if (user?.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId) {
        throw new ForbiddenException(
          'El administrador de empresa no tiene empresa asociada.',
        );
      }
      if (sedeIds.length === 0) {
        throw new ForbiddenException(
          'Debe asociar el servicio al menos a una sede de su empresa.',
        );
      }
    }

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
      if (sedeIds.length) {
        const sedes = await tx.sede.findMany({
          where: { id: { in: sedeIds } },
          select: { id: true, empresaId: true },
        });
        if (sedes.length !== sedeIds.length) {
          throw new NotFoundException('Una o más sedes no existen');
        }

        if (user?.role === Role.COMPANY_ADMIN) {
          const invalid = sedes.some(
            (sede) => sede.empresaId !== user.empresaId,
          );
          if (invalid) {
            throw new ForbiddenException(
              'No puede asociar sedes que no pertenezcan a su empresa.',
            );
          }
        }

        if (user?.role === Role.BRANCH_ADMIN) {
          const invalid = sedes.some((sede) => sede.id !== user.sedeId);
          if (invalid) {
            throw new ForbiddenException(
              'No puede asociar sedes distintas a la suya.',
            );
          }
        }

        sedeConnect = {
          connect: sedeIds.map((id) => ({ id })),
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
  async update(id: number, dto: UpdateServiceDto, user?: AuthenticatedUser) {
    await this.accessControlService.ensureServiceAccessForUser(id, user);
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException('El servicio no existe');
    }

    return this.prisma.$transaction(async (tx) => {
      let sedeIds = dto.sedeIds ? [...dto.sedeIds] : undefined;

      if (sedeIds) {
        if (user?.role === Role.BRANCH_ADMIN) {
          if (!user.sedeId) {
            throw new ForbiddenException(
              'El administrador de sede no tiene una sede asociada.',
            );
          }
          const invalid = sedeIds.some((sedeId) => sedeId !== user.sedeId);
          if (invalid) {
            throw new ForbiddenException(
              'No puede asociar sedes distintas a la suya.',
            );
          }
          sedeIds = [user.sedeId];
        }

        if (user?.role === Role.COMPANY_ADMIN) {
          if (!user.empresaId) {
            throw new ForbiddenException(
              'El administrador de empresa no tiene empresa asociada.',
            );
          }
        }
      }

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
      if (sedeIds) {
        const sedes = await tx.sede.findMany({
          where: { id: { in: sedeIds } },
          select: { id: true, empresaId: true },
        });

        if (sedes.length !== sedeIds.length) {
          throw new NotFoundException('Una o más sedes no existen');
        }

        if (user?.role === Role.COMPANY_ADMIN) {
          const invalid = sedes.some(
            (sede) => sede.empresaId !== user.empresaId,
          );
          if (invalid) {
            throw new ForbiddenException(
              'No puede asociar sedes que no pertenezcan a su empresa.',
            );
          }
        }

        if (user?.role === Role.BRANCH_ADMIN) {
          const invalid = sedes.some((sede) => sede.id !== user.sedeId);
          if (invalid) {
            throw new ForbiddenException(
              'No puede asociar sedes distintas a la suya.',
            );
          }
        }

        sedeConnect = {
          set: sedeIds.map((id) => ({ id })), // reemplaza todas las sedes previas
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
        /* La categoría se pedía pero luego no se devolvía, así que el
           panel mostraba todos los servicios como "Sin categoría".
           Hace falta incluir también su traducción: `category: true`
           trae la fila pero no el nombre, que vive en category_translation. */
        category: {
          include: { translations: { where: { language }, take: 1 } },
        },
      },
    });

    return services.map((service) => ({
      id: service.id,
      name: service.translations[0]?.name ?? 'Sin traducción',
      description: service.translations[0]?.description ?? '',
      prices: service.prices,
      sedes: service.sedes,
      categoryId: service.categoryId,
      category: service.category
        ? {
            id: service.category.id,
            name: service.category.translations[0]?.name ?? null,
            image: service.category.image,
          }
        : null,
    }));
  }

  // 🔴 Eliminar servicio y dependencias
  async remove(id: number, user?: AuthenticatedUser) {
    await this.accessControlService.ensureServiceAccessForUser(id, user);
    const existing = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceTranslation.deleteMany({ where: { serviceId: id } });
      await tx.price.deleteMany({ where: { serviceId: id } });
      return tx.service.delete({ where: { id } });
    });
  }

  // 🔹 Listar servicios por categoría con idioma filtrado
  async findByCategory(categoryId: number, language: string = 'es') {
    const services = await this.prisma.service.findMany({
      where: { categoryId },
      include: {
        translations: {
          where: { language },
          select: {
            id: true,
            name: true,
            description: true,
            language: true,
          },
        },
        prices: {
          select: {
            id: true,
            serviceId: true,
            amount: true,
            duration: true,
            currency: true,
          },
        },
        serviceSedeProfesional: {
          include: {
            sede: {
              select: {
                id: true,
                nombre: true,
                direccion: true,
                telefono: true,
                latitud: true,
                longitud: true,
                provincia: true,
                horario: true,
                diasCerrado: true,
                imagenes: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            profesional: {
              select: {
                id: true,
                nombre: true,
                biografia: true,
                imagen: true,
                phone: true,
                state: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (!services || services.length === 0) {
      throw new NotFoundException(
        `No se encontraron servicios para la categoría ID ${categoryId}`,
      );
    }

    // 🔹 Transformamos para agrupar sedes (sin duplicar servicios)
    return services.map((service) => ({
      id: service.id,
      name: service.translations[0]?.name || 'Sin traducción',
      description: service.translations[0]?.description || '',
      prices: service.prices,
      sedes: service.serviceSedeProfesional.map((ssp) => ssp.sede),
      profesionales: service.serviceSedeProfesional
        .map((ssp) => ssp.profesional)
        .filter(Boolean), // elimina nulls
    }));
  }

  // 🔹 Obtener todos los servicios de una sede específica
  async findBySede(sedeId: number, language: string = 'es') {
    // 1️⃣ Buscar todos los servicios relacionados a la sede
    const services = await this.prisma.service.findMany({
      where: {
        serviceSedeProfesional: {
          some: { sedeId },
        },
      },
      include: {
        translations: {
          where: { language },
          select: {
            id: true,
            name: true,
            description: true,
            language: true,
          },
        },
        prices: {
          select: {
            id: true,
            amount: true,
            duration: true,
            currency: true,
          },
        },
        category: {
          include: {
            translations: {
              where: { language },
              select: { name: true, description: true },
            },
          },
        },
        serviceSedeProfesional: {
          where: { sedeId },
          include: {
            profesional: {
              select: {
                id: true,
                nombre: true,
                biografia: true,
                imagen: true,
                phone: true,
                state: true,
              },
            },
            sede: {
              select: {
                id: true,
                nombre: true,
                direccion: true,
                telefono: true,
                latitud: true,
                longitud: true,
                provincia: true,
                imagenes: true,
              },
            },
          },
        },
      },
    });

    if (!services || services.length === 0) {
      throw new NotFoundException(
        `No se encontraron servicios para la sede ID ${sedeId}`,
      );
    }

    // 2️⃣ Agrupar la información final
    return services.map((service) => ({
      id: service.id,
      name: service.translations[0]?.name ?? 'Sin traducción',
      description: service.translations[0]?.description ?? '',
      category: service.category?.translations?.[0]?.name ?? 'Sin categoría',
      prices: service.prices,
      profesionales: service.serviceSedeProfesional
        .map((ssp) => ssp.profesional)
        .filter(Boolean),
      sede: service.serviceSedeProfesional[0]?.sede,
    }));
  }
}
