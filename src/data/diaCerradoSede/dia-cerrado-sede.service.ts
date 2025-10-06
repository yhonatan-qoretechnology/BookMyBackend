import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiaCerradoSedeDto } from './dto/create-dia-cerrado-sede.dto';
import { UpdateDiaCerradoSedeDto } from './dto/update-dia-cerrado-sede.dto';

@Injectable()
export class DiaCerradoSedeService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear día cerrado
  async create(dto: CreateDiaCerradoSedeDto) {
    const { sedeId, fecha, todoElDia, horaInicio, horaFin } = dto;

    // Validar sede
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede)
      throw new NotFoundException(`Sede con id ${sedeId} no encontrada`);

    // Validar que no exista ya un cierre para esa fecha
    const existente = await this.prisma.diaCerradoSede.findFirst({
      where: { sedeId, fecha: new Date(fecha) },
    });
    if (existente)
      throw new ConflictException(
        `Ya existe un registro de cierre para la sede ${sedeId} el ${fecha}`,
      );

    // Validar coherencia si no es todo el día
    if (!todoElDia) {
      if (!horaInicio || !horaFin)
        throw new BadRequestException(
          'Debe indicar horaInicio y horaFin si no es todo el día',
        );

      if (horaFin <= horaInicio)
        throw new BadRequestException(
          'horaFin debe ser posterior a horaInicio',
        );
    }

    return this.prisma.diaCerradoSede.create({
      data: {
        sedeId,
        fecha: new Date(fecha),
        motivo: dto.motivo,
        todoElDia,
        horaInicio,
        horaFin,
      },
    });
  }

  // Listar días cerrados
  async findAll(params?: { sedeId?: number; desde?: string; hasta?: string }) {
    const where: any = {};
    if (params?.sedeId) where.sedeId = params.sedeId;
    if (params?.desde || params?.hasta) {
      where.fecha = {};
      if (params.desde) where.fecha.gte = new Date(params.desde);
      if (params.hasta) where.fecha.lte = new Date(params.hasta);
    }

    return this.prisma.diaCerradoSede.findMany({
      where,
      include: { sede: { select: { id: true, nombre: true } } },
      orderBy: { fecha: 'asc' },
    });
  }

  // Obtener un día cerrado
  async findOne(id: number) {
    const dia = await this.prisma.diaCerradoSede.findUnique({
      where: { id },
      include: {
        sede: { select: { id: true, nombre: true, direccion: true } },
      },
    });
    if (!dia)
      throw new NotFoundException(`Día cerrado con id ${id} no encontrado`);
    return dia;
  }

  // Actualizar
  async update(id: number, dto: UpdateDiaCerradoSedeDto) {
    const existente = await this.prisma.diaCerradoSede.findUnique({
      where: { id },
    });
    if (!existente)
      throw new NotFoundException(`Día cerrado con id ${id} no encontrado`);

    const sedeId = dto.sedeId ?? existente.sedeId;
    const fecha = dto.fecha ?? existente.fecha.toISOString().split('T')[0];

    const duplicado = await this.prisma.diaCerradoSede.findFirst({
      where: { sedeId, fecha: new Date(fecha), NOT: { id } },
    });
    if (duplicado)
      throw new ConflictException(
        `Ya existe un cierre para la sede ${sedeId} en ${fecha}`,
      );

    if (!dto.todoElDia) {
      if (!dto.horaInicio || !dto.horaFin)
        throw new BadRequestException(
          'Debe indicar horaInicio y horaFin si no es todo el día',
        );

      if (dto.horaFin <= dto.horaInicio)
        throw new BadRequestException(
          'horaFin debe ser posterior a horaInicio',
        );
    }

    return this.prisma.diaCerradoSede.update({
      where: { id },
      data: { ...dto, fecha: new Date(fecha) },
    });
  }

  // Eliminar día cerrado
  async remove(id: number) {
    const dia = await this.prisma.diaCerradoSede.findUnique({ where: { id } });
    if (!dia)
      throw new NotFoundException(`Día cerrado con id ${id} no encontrado`);
    return this.prisma.diaCerradoSede.delete({ where: { id } });
  }
}
