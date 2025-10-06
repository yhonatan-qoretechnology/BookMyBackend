import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceSedeProfesionalDto } from './dto/create-service-sede-profesional.dto';
import { UpdateServiceSedeProfesionalDto } from './dto/update-service-sede-profesional.dto';

@Injectable()
export class ServiceSedeProfesionalService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear relación (Sede - Servicio - Profesional [opcional])
  async create(dto: CreateServiceSedeProfesionalDto) {
    const { sedeId, serviceId, profesionalId } = dto;

    // Validar existencia de sede y servicio
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede)
      throw new NotFoundException(`Sede con id ${sedeId} no encontrada`);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service)
      throw new NotFoundException(`Service con id ${serviceId} no encontrado`);

    // Si se pasó profesional, validar existencia y que pertenezca a la sede indicada
    if (profesionalId) {
      const profesional = await this.prisma.profesional.findUnique({
        where: { id: profesionalId },
      });
      if (!profesional)
        throw new NotFoundException(
          `Profesional con id ${profesionalId} no encontrado`,
        );
      if (profesional.sedeId !== sedeId) {
        throw new BadRequestException(
          `El profesional ${profesionalId} no pertenece a la sede ${sedeId}`,
        );
      }
    }

    // Prevenir duplicados (la tabla tiene unique sobre [sedeId, serviceId, profesionalId])
    const existing = await this.prisma.serviceSedeProfesional.findFirst({
      where: {
        sedeId,
        serviceId,
        profesionalId: profesionalId ?? null,
      },
    });
    if (existing)
      throw new ConflictException(
        'La relación ya existe (sede, servicio, profesional)',
      );

    // Crear
    return this.prisma.serviceSedeProfesional.create({
      data: {
        sedeId,
        serviceId,
        profesionalId: profesionalId ?? null,
      },
    });
  }

  // Listar (con filtros simples opcionales)
  async findAll(params?: {
    sedeId?: number;
    serviceId?: number;
    profesionalId?: number;
  }) {
    const where: any = {};
    if (params?.sedeId) where.sedeId = params.sedeId;
    if (params?.serviceId) where.serviceId = params.serviceId;
    if (params?.profesionalId) where.profesionalId = params.profesionalId;

    return this.prisma.serviceSedeProfesional.findMany({
      where,
      include: {
        sede: { select: { id: true, nombre: true } },
        service: { select: { id: true } },
        profesional: { select: { id: true, nombre: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  // Obtener por id
  async findOne(id: number) {
    const rec = await this.prisma.serviceSedeProfesional.findUnique({
      where: { id },
      include: {
        sede: { select: { id: true, nombre: true, direccion: true } },
        service: { select: { id: true } },
        profesional: { select: { id: true, nombre: true } },
      },
    });
    if (!rec)
      throw new NotFoundException(`Registro con id ${id} no encontrado`);
    return rec;
  }

  // Actualizar
  async update(id: number, dto: UpdateServiceSedeProfesionalDto) {
    const existing = await this.prisma.serviceSedeProfesional.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Registro con id ${id} no encontrado`);

    const newSedeId = dto.sedeId ?? existing.sedeId;
    const newServiceId = dto.serviceId ?? existing.serviceId;
    const newProfesionalId = dto.profesionalId ?? existing.profesionalId;

    // Validar sede y servicio si cambiaron
    if (dto.sedeId) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: newSedeId },
      });
      if (!sede)
        throw new NotFoundException(`Sede con id ${newSedeId} no encontrada`);
    }
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: newServiceId },
      });
      if (!service)
        throw new NotFoundException(
          `Service con id ${newServiceId} no encontrado`,
        );
    }

    // Si hay profesional validar pertenencia a sede
    if (newProfesionalId) {
      const profesional = await this.prisma.profesional.findUnique({
        where: { id: newProfesionalId },
      });
      if (!profesional)
        throw new NotFoundException(
          `Profesional con id ${newProfesionalId} no encontrado`,
        );
      if (profesional.sedeId !== newSedeId) {
        throw new BadRequestException(
          `El profesional ${newProfesionalId} no pertenece a la sede ${newSedeId}`,
        );
      }
    }

    // Verificar que la combinación no duplique otra fila diferente
    const duplicate = await this.prisma.serviceSedeProfesional.findFirst({
      where: {
        sedeId: newSedeId,
        serviceId: newServiceId,
        profesionalId: newProfesionalId ?? null,
        NOT: { id },
      },
    });
    if (duplicate)
      throw new ConflictException(
        'La relación resultante ya existe (duplica otro registro)',
      );

    // Update
    return this.prisma.serviceSedeProfesional.update({
      where: { id },
      data: {
        sedeId: newSedeId,
        serviceId: newServiceId,
        profesionalId: newProfesionalId ?? null,
      },
    });
  }

  // Eliminar
  async remove(id: number) {
    // Verificar existencia
    const existing = await this.prisma.serviceSedeProfesional.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Registro con id ${id} no encontrado`);

    return this.prisma.serviceSedeProfesional.delete({ where: { id } });
  }
}
