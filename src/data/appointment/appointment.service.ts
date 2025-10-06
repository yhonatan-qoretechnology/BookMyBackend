import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateAppointmentDto) {
    // Validar si el profesional ya tiene una cita en ese rango
    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        profesionalId: data.profesionalId,
        horaInicio: { lte: new Date(data.horaFin) },
        horaFin: { gte: new Date(data.horaInicio) },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'El profesional ya tiene una cita en ese horario',
      );
    }

    // Crear cita
    return this.prisma.appointment.create({
      data: {
        ...data,
        fecha: new Date(data.fecha),
        horaInicio: new Date(data.horaInicio),
        horaFin: new Date(data.horaFin),
      },
    });
  }

  async findAll() {
    return this.prisma.appointment.findMany({
      include: {
        sede: true,
        service: true,
        profesional: true,
        user: true,
      },
      orderBy: { fecha: 'asc' },
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        sede: true,
        service: true,
        profesional: true,
        user: true,
      },
    });
    if (!appointment) throw new NotFoundException('Cita no encontrada');
    return appointment;
  }

  async update(id: number, data: UpdateAppointmentDto) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        fecha: data.fecha ? new Date(data.fecha) : cita.fecha,
        horaInicio: data.horaInicio
          ? new Date(data.horaInicio)
          : cita.horaInicio,
        horaFin: data.horaFin ? new Date(data.horaFin) : cita.horaFin,
      },
    });
  }

  async cancel(id: number, motivo = 'Cancelado por el usuario') {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        estado: AppointmentStatus.CANCELLED,
        notas: motivo,
      },
    });
  }

  async remove(id: number) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada');
    return this.prisma.appointment.delete({ where: { id } });
  }
}
