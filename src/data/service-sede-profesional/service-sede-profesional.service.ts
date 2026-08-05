import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceSedeProfesionalDto } from './dto/create-service-sede-profesional.dto';
import { UpdateServiceSedeProfesionalDto } from './dto/update-service-sede-profesional.dto';

@Injectable()
export class ServiceSedeProfesionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
  ) {}

  async findServiciosConAsignacion(
    sedeId: number,
    profesionalId: number,
    language: string = 'es',
    user: AuthenticatedUser,
  ) {
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    await this.accessControlService.ensureSedeAccessForUser(sedeId, user);
    await this.accessControlService.ensureProfessionalAccessForUser(
      profesionalId,
      user,
    );

    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
      select: { id: true, sedeId: true },
    });

    if (!profesional) {
      throw new NotFoundException(
        `Profesional con ID ${profesionalId} no encontrado.`,
      );
    }

    if (profesional.sedeId !== sedeId) {
      throw new BadRequestException(
        'El profesional no pertenece a la sede indicada.',
      );
    }

    const asignados = await this.prisma.serviceSedeProfesional.findMany({
      where: {
        sedeId,
        profesionalId,
      },
      select: { id: true, serviceId: true },
    });

    /* Se devuelve también el id de la relación: sin él, para quitar una
       asignación habría que traerse la tabla entera, porque GET /
       no admite filtros. */
    const asignadosPorServicio = new Map(
      asignados.map((a) => [a.serviceId, a.id]),
    );

    const services = await this.prisma.service.findMany({
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
      },
      orderBy: { id: 'asc' },
    });

    return services.map((service) => ({
      id: service.id,
      nombre: service.translations[0]?.name ?? 'Sin traducción',
      descripcion: service.translations[0]?.description ?? '',
      categoria: service.category?.translations?.[0]?.name ?? 'Sin categoría',
      precios: service.prices,
      asignado: asignadosPorServicio.has(service.id),
      /** id de service_sede_profesional; null si no está asignado */
      asignacionId: asignadosPorServicio.get(service.id) ?? null,
    }));
  }

  /**
   * Crea una nueva relación en la tabla ServiceSedeProfesional.
   * Valida que el servicio, la sede y el profesional existan antes de la creación.
   * @param createDto DTO con los IDs de servicio, sede y profesional.
   * @returns La nueva relación creada.
   */
  async create(
    createDto: CreateServiceSedeProfesionalDto,
    user?: AuthenticatedUser,
  ) {
    const { sedeId, serviceId, profesionalId } = createDto;

    // 1. Validar que la sede, el servicio y el profesional existan.
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true, empresaId: true },
    });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { sedes: { select: { id: true, empresaId: true } } },
    });
    if (!service) {
      throw new NotFoundException(
        `Servicio con ID ${serviceId} no encontrado.`,
      );
    }

    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
      select: { id: true, sedeId: true, sede: { select: { empresaId: true } } },
    });
    if (!profesional) {
      throw new NotFoundException(
        `Profesional con ID ${profesionalId} no encontrado.`,
      );
    }

    if (user?.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId) {
        throw new ForbiddenException(
          'El administrador de empresa no tiene empresa asociada.',
        );
      }

      const recursosEmpresa = [
        sede.empresaId,
        ...service.sedes.map((s) => s.empresaId),
        profesional.sede?.empresaId,
      ];

      const pertenece = recursosEmpresa.every(
        (empresaId) => empresaId === user.empresaId,
      );

      if (!pertenece) {
        throw new ForbiddenException(
          'Solo puede asociar recursos de su empresa.',
        );
      }
    }

    if (user?.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId) {
        throw new ForbiddenException('No tiene una sede asociada.');
      }

      const sedesServicio = service.sedes.map((s) => s.id);

      if (
        sede.id !== user.sedeId ||
        profesional.sedeId !== user.sedeId ||
        !sedesServicio.includes(user.sedeId)
      ) {
        throw new ForbiddenException(
          'No puede asociar recursos fuera de su sede.',
        );
      }
    }

    // 2. Crear el registro y mantener sincronizada la pertenencia.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const relacion = await tx.serviceSedeProfesional.create({
          data: {
            sedeId,
            serviceId,
            profesionalId,
          },
        });

        /* La relación Sede<->Service es la que usa el control de acceso
           para saber de qué empresa es un servicio. Si no se conecta
           aquí, el servicio se puede reservar pero el administrador de
           la empresa recibe un 403 al intentar editarlo. */
        await tx.sede.update({
          where: { id: sedeId },
          data: { Service: { connect: { id: serviceId } } },
        });

        return relacion;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Manejar el error de duplicado (P2002)
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Esta relación entre sede, servicio y profesional ya existe.',
          );
        }
      }
      throw error;
    }
  }

  /**
   * Obtiene todas las relaciones de la tabla.
   * @returns Todas las relaciones.
   */
  async findAll() {
    return this.prisma.serviceSedeProfesional.findMany();
  }

  /**
   * Obtiene una relación específica por su ID.
   * @param id ID de la relación.
   * @returns La relación encontrada.
   * @throws NotFoundException si la relación no existe.
   */
  async findOne(id: number) {
    const relacion = await this.prisma.serviceSedeProfesional.findUnique({
      where: { id },
    });
    if (!relacion) {
      throw new NotFoundException(`Relación con ID ${id} no encontrada.`);
    }
    return relacion;
  }

  /**
   * Actualiza una relación existente.
   * @param id ID de la relación a actualizar.
   * @param updateDto DTO con los datos a actualizar.
   * @returns La relación actualizada.
   * @throws NotFoundException si la relación no existe.
   */
  async update(
    id: number,
    updateDto: UpdateServiceSedeProfesionalDto,
    user: AuthenticatedUser,
  ) {
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    await this.findOne(id); // Validar que la relación existe

    if (updateDto.sedeId) {
      await this.accessControlService.ensureSedeAccessForUser(
        updateDto.sedeId,
        user,
      );
    }

    if (updateDto.profesionalId) {
      await this.accessControlService.ensureProfessionalAccessForUser(
        updateDto.profesionalId,
        user,
      );
    }

    if (updateDto.serviceId) {
      await this.accessControlService.ensureServiceAccessForUser(
        updateDto.serviceId,
        user,
      );
    }

    try {
      return await this.prisma.serviceSedeProfesional.update({
        where: { id },
        data: updateDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Relación con ID ${id} no encontrada.`);
        }
      }
      throw error;
    }
  }

  /**
   * Elimina una relación por su ID.
   * @param id ID de la relación a eliminar.
   * @returns La relación eliminada.
   * @throws NotFoundException si la relación no existe.
   */
  async remove(id: number, user: AuthenticatedUser) {
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    await this.findOne(id); // Validar que la relación existe

    if (user.role !== Role.SUPER_ADMIN) {
      const relacion = await this.prisma.serviceSedeProfesional.findUnique({
        where: { id },
        select: {
          sedeId: true,
          serviceId: true,
          profesionalId: true,
        },
      });

      if (!relacion) {
        throw new NotFoundException('Relación no encontrada.');
      }

      await this.accessControlService.ensureSedeAccessForUser(
        relacion.sedeId,
        user,
      );
      await this.accessControlService.ensureServiceAccessForUser(
        relacion.serviceId,
        user,
      );
      if (relacion.profesionalId !== null) {
        await this.accessControlService.ensureProfessionalAccessForUser(
          relacion.profesionalId,
          user,
        );
      }
    }

    const relacion = await this.prisma.serviceSedeProfesional.findUnique({
      where: { id },
      select: { sedeId: true, serviceId: true },
    });

    return await this.prisma.$transaction(async (tx) => {
      const borrada = await tx.serviceSedeProfesional.delete({ where: { id } });

      /* Si ese servicio ya no lo presta nadie en la sede, se desconecta
         también de la pertenencia para que ambas tablas sigan diciendo
         lo mismo. Mientras quede algún profesional, se conserva. */
      if (relacion) {
        const quedan = await tx.serviceSedeProfesional.count({
          where: { sedeId: relacion.sedeId, serviceId: relacion.serviceId },
        });

        if (quedan === 0) {
          await tx.sede.update({
            where: { id: relacion.sedeId },
            data: { Service: { disconnect: { id: relacion.serviceId } } },
          });
        }
      }

      return borrada;
    });
  }
}
