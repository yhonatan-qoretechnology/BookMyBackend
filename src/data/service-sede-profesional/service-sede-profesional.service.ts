import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceSedeProfesionalDto } from './dto/create-service-sede-profesional.dto';
import { UpdateServiceSedeProfesionalDto } from './dto/update-service-sede-profesional.dto';

@Injectable()
export class ServiceSedeProfesionalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva relación en la tabla ServiceSedeProfesional.
   * Valida que el servicio, la sede y el profesional existan antes de la creación.
   * @param createDto DTO con los IDs de servicio, sede y profesional.
   * @returns La nueva relación creada.
   */
  async create(createDto: CreateServiceSedeProfesionalDto) {
    const { sedeId, serviceId, profesionalId } = createDto;

    // 1. Validar que la sede, el servicio y el profesional existan.
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throw new NotFoundException(
        `Servicio con ID ${serviceId} no encontrado.`,
      );
    }

    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
    });
    if (!profesional) {
      throw new NotFoundException(
        `Profesional con ID ${profesionalId} no encontrado.`,
      );
    }

    // 2. Crear el registro en la tabla de relación.
    try {
      return await this.prisma.serviceSedeProfesional.create({
        data: {
          sedeId,
          serviceId,
          profesionalId,
        },
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
  async update(id: number, updateDto: UpdateServiceSedeProfesionalDto) {
    await this.findOne(id); // Validar que la relación existe

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
  async remove(id: number) {
    await this.findOne(id); // Validar que la relación existe

    return await this.prisma.serviceSedeProfesional.delete({ where: { id } });
  }
}
