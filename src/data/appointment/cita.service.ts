import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCitaDto } from './dto/createCita.dto';

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
}
