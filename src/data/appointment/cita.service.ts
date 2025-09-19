import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCitaDto } from './dto/createCita.dto';
import { UpdateCitaDto } from './dto/update-cita.dto';

@Injectable()
export class CitaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agenda una nueva cita, validando el horario de la sede y la disponibilidad del profesional.
   * @param createCitaDto Los datos de la cita a agendar.
   * @returns La cita recién creada.
   */
  async create(createCitaDto: CreateCitaDto) {
    const { sedeId, serviceId, profesionalId, fecha, hora } = createCitaDto;

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

    // 2. Validar el horario de la sede.
    const fechaCita = new Date(fecha);
    const diaSemana = fechaCita.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const diasSemanaMap = [
      'domingo',
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
      'sabado',
    ];
    const nombreDia = diasSemanaMap[diaSemana];

    const horarioSede = sede.horario as any;
    const diasCerradoSede = sede.diasCerrado as any;

    if (diasCerradoSede && diasCerradoSede.includes(nombreDia)) {
      throw new BadRequestException(
        `La sede está cerrada el día ${nombreDia}.`,
      );
    }

    if (horarioSede && horarioSede[nombreDia]) {
      const { apertura, cierre } = horarioSede[nombreDia];
      const horaCita = new Date(`${fecha}T${hora}:00`);
      const horaApertura = new Date(`${fecha}T${apertura}:00`);
      const horaCierre = new Date(`${fecha}T${cierre}:00`);

      if (horaCita < horaApertura || horaCita >= horaCierre) {
        throw new BadRequestException(
          `La hora de la cita (${hora}) no está dentro del horario de atención de la sede (${apertura} - ${cierre}).`,
        );
      }
    } else {
      // Si el día no tiene un horario definido, se asume que está cerrado.
      throw new BadRequestException(
        `La sede no tiene horario definido para el día ${nombreDia}.`,
      );
    }

    // 3. Verificar la disponibilidad del profesional.
    const citaExistente = await this.prisma.appointment.findFirst({
      where: {
        profesionalId,
        fecha: fechaCita,
        hora,
      },
    });

    if (citaExistente) {
      throw new BadRequestException(
        `El profesional ya tiene una cita agendada para el día ${fecha} a las ${hora}.`,
      );
    }

    // 4. Si todas las validaciones pasan, se crea la cita.
    const nuevaCita = await this.prisma.appointment.create({
      data: {
        sedeId,
        serviceId,
        profesionalId,
        fecha: fechaCita,
        hora,
      },
    });

    return nuevaCita;
  }

  /**
   * Actualiza una cita existente.
   * @param id El ID de la cita a actualizar.
   * @param updateCitaDto Los datos actualizados.
   * @returns La cita actualizada.
   */
  async update(id: number, updateCitaDto: UpdateCitaDto) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) {
      throw new NotFoundException(`Cita con ID ${id} no encontrada.`);
    }

    // Si se actualiza el profesional, la fecha o la hora, se verifica la disponibilidad.
    if (
      updateCitaDto.profesionalId ||
      updateCitaDto.fecha ||
      updateCitaDto.hora
    ) {
      const profesionalId = updateCitaDto.profesionalId || cita.profesionalId;
      const fecha = updateCitaDto.fecha || cita.fecha;
      const hora = updateCitaDto.hora || cita.hora;

      const citaExistente = await this.prisma.appointment.findFirst({
        where: {
          profesionalId,
          fecha,
          hora,
          NOT: { id }, // Ignora la cita actual para evitar conflictos.
        },
      });

      if (citaExistente) {
        throw new BadRequestException(
          `El profesional ya tiene una cita agendada para el día ${fecha} a las ${hora}.`,
        );
      }
    }

    return this.prisma.appointment.update({
      where: { id },
      data: updateCitaDto,
    });
  }

  /**
   * Elimina una cita.
   * @param id El ID de la cita a eliminar.
   * @returns La cita eliminada.
   */
  async remove(id: number) {
    const cita = await this.prisma.appointment.findUnique({ where: { id } });
    if (!cita) {
      throw new NotFoundException(`Cita con ID ${id} no encontrada.`);
    }

    return this.prisma.appointment.delete({ where: { id } });
  }
}
