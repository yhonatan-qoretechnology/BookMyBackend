import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateHorarioSedeDto } from './dto/create-horario-sede.dto';
import { UpdateHorarioSedeDto } from './dto/update-horario-sede.dto';

@Injectable()
export class HorarioSedeService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear horario de sede
  async create(dto: CreateHorarioSedeDto) {
    const { sedeId, diaSemana, horaApertura, horaCierre, activo } = dto;

    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede)
      throw new NotFoundException(`Sede con id ${sedeId} no encontrada`);

    // Validar que el día no esté duplicado para la sede
    const existing = await this.prisma.horarioSede.findUnique({
      where: { sedeId_diaSemana: { sedeId, diaSemana } },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un horario para la sede ${sedeId} en el día ${diaSemana}`,
      );
    }

    // Validar coherencia de horarios
    if (horaCierre <= horaApertura)
      throw new BadRequestException(
        'La hora de cierre debe ser posterior a la de apertura',
      );

    return this.prisma.horarioSede.create({
      data: { sedeId, diaSemana, horaApertura, horaCierre, activo },
    });
  }

  // Listar horarios (con filtros opcionales)
  async findAll(params?: { sedeId?: number; activo?: boolean }) {
    const where: any = {};
    if (params?.sedeId) where.sedeId = params.sedeId;
    if (params?.activo !== undefined) where.activo = params.activo;

    return this.prisma.horarioSede.findMany({
      where,
      include: { sede: { select: { id: true, nombre: true } } },
      orderBy: [{ sedeId: 'asc' }, { diaSemana: 'asc' }],
    });
  }

  // Obtener un horario
  async findOne(id: number) {
    const horario = await this.prisma.horarioSede.findUnique({
      where: { id },
      include: {
        sede: { select: { id: true, nombre: true, direccion: true } },
      },
    });
    if (!horario)
      throw new NotFoundException(`Horario con id ${id} no encontrado`);
    return horario;
  }

  // Actualizar horario
  async update(id: number, dto: UpdateHorarioSedeDto) {
    const horario = await this.prisma.horarioSede.findUnique({ where: { id } });
    if (!horario)
      throw new NotFoundException(`Horario con id ${id} no encontrado`);

    const newSedeId = dto.sedeId ?? horario.sedeId;
    const newDiaSemana = dto.diaSemana ?? horario.diaSemana;

    // Validar que la sede exista si cambia
    if (dto.sedeId) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: newSedeId },
      });
      if (!sede)
        throw new NotFoundException(`Sede con id ${newSedeId} no encontrada`);
    }

    // Validar duplicado si cambia sede o día
    if (dto.sedeId || dto.diaSemana) {
      const duplicate = await this.prisma.horarioSede.findUnique({
        where: {
          sedeId_diaSemana: { sedeId: newSedeId, diaSemana: newDiaSemana },
        },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Ya existe un horario para la sede ${newSedeId} y día ${newDiaSemana}`,
        );
      }
    }

    // Validar coherencia de horas
    const horaApertura = dto.horaApertura ?? horario.horaApertura;
    const horaCierre = dto.horaCierre ?? horario.horaCierre;
    if (horaCierre <= horaApertura)
      throw new BadRequestException(
        'La hora de cierre debe ser posterior a la de apertura',
      );

    return this.prisma.horarioSede.update({
      where: { id },
      data: { ...dto },
    });
  }

  // Eliminar horario
  async remove(id: number) {
    const horario = await this.prisma.horarioSede.findUnique({ where: { id } });
    if (!horario)
      throw new NotFoundException(`Horario con id ${id} no encontrado`);
    return this.prisma.horarioSede.delete({ where: { id } });
  }
}
