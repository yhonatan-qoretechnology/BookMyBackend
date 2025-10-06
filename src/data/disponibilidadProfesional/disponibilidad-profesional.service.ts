import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDisponibilidadProfesionalDto } from './dto/create-disponibilidad-profesional.dto';
import { UpdateDisponibilidadProfesionalDto } from './dto/update-disponibilidad-profesional.dto';

@Injectable()
export class DisponibilidadProfesionalService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear registro de disponibilidad o ausencia para un día específico
  async create(dto: CreateDisponibilidadProfesionalDto) {
    const { profesionalId, fecha, disponible, horaInicio, horaFin, motivo } =
      dto;

    // Validar profesional
    const profesional = await this.prisma.profesional.findUnique({
      where: { id: profesionalId },
    });
    if (!profesional)
      throw new NotFoundException(
        `Profesional con id ${profesionalId} no encontrado`,
      );

    // Normalizar fecha (solo YYYY-MM-DD)
    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime()))
      throw new BadRequestException('Fecha inválida');

    // Validar existencia previa (único por profesional y fecha)
    const existing = await this.prisma.disponibilidadProfesional.findUnique({
      where: { profesionalId_fecha: { profesionalId, fecha: fechaDate } },
    });
    if (existing)
      throw new ConflictException(
        `Ya existe disponibilidad para el profesional ${profesionalId} en ${fecha}`,
      );

    // Si se pasan horas, validar coherencia
    if ((horaInicio && !horaFin) || (!horaInicio && horaFin)) {
      throw new BadRequestException(
        'Si especifica horaInicio debe especificar horaFin y viceversa',
      );
    }
    if (horaInicio && horaFin && horaFin <= horaInicio) {
      throw new BadRequestException('horaFin debe ser posterior a horaInicio');
    }

    return this.prisma.disponibilidadProfesional.create({
      data: {
        profesionalId,
        fecha: fechaDate,
        disponible,
        horaInicio,
        horaFin,
        motivo,
      },
    });
  }

  // Listar disponibilidades (filtros: profesionalId, rango de fechas)
  async findAll(params?: {
    profesionalId?: number;
    desde?: string;
    hasta?: string;
    disponible?: boolean;
  }) {
    const where: any = {};
    if (params?.profesionalId) where.profesionalId = params.profesionalId;
    if (params?.disponible !== undefined) where.disponible = params.disponible;
    if (params?.desde || params?.hasta) {
      where.fecha = {};
      if (params.desde) {
        const desdeDate = new Date(params.desde);
        if (isNaN(desdeDate.getTime()))
          throw new BadRequestException('Fecha "desde" inválida');
        where.fecha.gte = desdeDate;
      }
      if (params.hasta) {
        const hastaDate = new Date(params.hasta);
        if (isNaN(hastaDate.getTime()))
          throw new BadRequestException('Fecha "hasta" inválida');
        where.fecha.lte = hastaDate;
      }
    }

    return this.prisma.disponibilidadProfesional.findMany({
      where,
      include: {
        profesional: { select: { id: true, nombre: true, sedeId: true } },
      },
      orderBy: { fecha: 'asc' },
    });
  }

  // Obtener uno
  async findOne(id: number) {
    const rec = await this.prisma.disponibilidadProfesional.findUnique({
      where: { id },
      include: { profesional: { select: { id: true, nombre: true } } },
    });
    if (!rec)
      throw new NotFoundException(`Disponibilidad con id ${id} no encontrada`);
    return rec;
  }

  // Actualizar
  async update(id: number, dto: UpdateDisponibilidadProfesionalDto) {
    const existing = await this.prisma.disponibilidadProfesional.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Disponibilidad con id ${id} no encontrada`);

    const newProfesionalId = dto.profesionalId ?? existing.profesionalId;
    const newFecha = dto.fecha ? new Date(dto.fecha) : existing.fecha;

    // Si cambia a otro profesional o fecha, validar unicidad
    if (dto.profesionalId || dto.fecha) {
      const duplicate = await this.prisma.disponibilidadProfesional.findUnique({
        where: {
          profesionalId_fecha: {
            profesionalId: newProfesionalId,
            fecha: newFecha,
          },
        },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'Ya existe un registro para ese profesional en esa fecha',
        );
      }
    }

    // Validar horas
    const horaInicio = dto.horaInicio ?? existing.horaInicio;
    const horaFin = dto.horaFin ?? existing.horaFin;
    if ((horaInicio && !horaFin) || (!horaInicio && horaFin)) {
      throw new BadRequestException(
        'Si especifica horaInicio debe especificar horaFin y viceversa',
      );
    }
    if (horaInicio && horaFin && horaFin <= horaInicio) {
      throw new BadRequestException('horaFin debe ser posterior a horaInicio');
    }

    return this.prisma.disponibilidadProfesional.update({
      where: { id },
      data: {
        profesionalId: dto.profesionalId ?? undefined,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        disponible: dto.disponible ?? undefined,
        horaInicio: dto.horaInicio ?? undefined,
        horaFin: dto.horaFin ?? undefined,
        motivo: dto.motivo ?? undefined,
      },
    });
  }

  // Eliminar
  async remove(id: number) {
    const existing = await this.prisma.disponibilidadProfesional.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Disponibilidad con id ${id} no encontrada`);
    return this.prisma.disponibilidadProfesional.delete({ where: { id } });
  }
}
