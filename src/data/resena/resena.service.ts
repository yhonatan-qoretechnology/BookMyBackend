import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResenaState, ResenaType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResenaDto } from './dto/create-resena.dto';
import { UpdateResenaDto } from './dto/update-resena.dto';

@Injectable()
export class ResenaService {
  constructor(private prisma: PrismaService) {}

  async create(createResenaDto: CreateResenaDto) {
    if (createResenaDto.tipo === ResenaType.SEDE) {
      if (createResenaDto.sedeId == null) {
        throw new BadRequestException(
          'Una reseña de tipo SEDE debe tener un sedeId.',
        );
      }
    }

    // Validar que el usuario existe
    const usuario = await this.prisma.users.findUnique({
      where: { id: createResenaDto.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(
        `Usuario con ID ${createResenaDto.usuarioId} no encontrado.`,
      );
    }

    // Validar que la sede o servicio existe según el tipo de reseña
    if (createResenaDto.sedeId != null) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: createResenaDto.sedeId },
      });
      if (!sede) {
        throw new NotFoundException(
          `Sede con ID ${createResenaDto.sedeId} no encontrada.`,
        );
      }
    }

    if (createResenaDto.serviceId != null) {
      const service = await this.prisma.service.findUnique({
        where: { id: createResenaDto.serviceId },
      });
      if (!service) {
        throw new NotFoundException(
          `Servicio con ID ${createResenaDto.serviceId} no encontrado.`,
        );
      }
    }

    const resena = await this.prisma.resena.create({
      data: createResenaDto,
    });

    const { sedeId, ...resenaSinRelaciones } = resena;

    return resenaSinRelaciones;
  }

  async findAll() {
    return this.prisma.resena.findMany({
      include: {
        sede: true,
        usuario: {
          include: {
            UserData: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const resena = await this.prisma.resena.findUnique({
      where: { id },
      include: {
        sede: true,
        usuario: {
          include: {
            UserData: true,
          },
        },
      },
    });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }
    return resena;
  }

  /**
   * Reseñas escritas por un usuario.
   *
   * La app las necesita para saber qué servicios ya ha valorado: con eso marca
   * cada reserva pasada como pendiente o completa y evita que la misma se
   * reseñe dos veces. Se devuelven todas, aprobadas o no, porque quien las
   * escribió tiene que ver la suya aunque siga en revisión.
   */
  async findByUsuario(usuarioId: number) {
    const usuario = await this.prisma.users.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(
        `Usuario con ID ${usuarioId} no encontrado.`,
      );
    }

    return this.prisma.resena.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySede(sedeId: number) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }
    const resenas = await this.prisma.resena.findMany({
      where: { sedeId },
      include: {
        sede: true,
        usuario: {
          include: {
            UserData: true,
          },
        },
      },
    });

    return resenas.map((resena) => ({
      ...resena,
      usuario: resena.usuario
        ? {
            ...resena.usuario,
            fotoPerfil: resena.usuario.fotoPerfil ?? '',
            UserData: resena.usuario.UserData ?? null,
          }
        : null,
    }));
  }

  async update(id: number, updateResenaDto: UpdateResenaDto) {
    const resena = await this.prisma.resena.findUnique({ where: { id } });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }

    const targetType = updateResenaDto.tipo ?? resena.tipo;
    const targetSedeId =
      updateResenaDto.sedeId !== undefined
        ? updateResenaDto.sedeId
        : resena.sedeId;
    if (targetType === ResenaType.SEDE) {
      if (targetSedeId == null) {
        throw new BadRequestException(
          'Una reseña de tipo SEDE debe tener un sedeId.',
        );
      }
    }

    // Validar que el usuario, sede o servicio existen si se actualizan los IDs
    if (updateResenaDto.usuarioId) {
      const usuario = await this.prisma.users.findUnique({
        where: { id: updateResenaDto.usuarioId },
      });
      if (!usuario) {
        throw new NotFoundException(
          `Usuario con ID ${updateResenaDto.usuarioId} no encontrado.`,
        );
      }
    }

    if (targetType === ResenaType.SEDE && targetSedeId != null) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: targetSedeId },
      });
      if (!sede) {
        throw new NotFoundException(
          `Sede con ID ${targetSedeId} no encontrada.`,
        );
      }
    }

    // Si se actualiza el sedeId, validar que la sede exista
    if (
      updateResenaDto.sedeId !== undefined &&
      updateResenaDto.sedeId != null
    ) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: updateResenaDto.sedeId },
      });
      if (!sede) {
        throw new NotFoundException(
          `Sede con ID ${updateResenaDto.sedeId} no encontrada.`,
        );
      }
    }

    return this.prisma.resena.update({
      where: { id },
      data: updateResenaDto,
    });
  }

  async approve(id: number, aprobado: boolean) {
    const resena = await this.prisma.resena.findUnique({ where: { id } });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }

    return this.prisma.resena.update({
      where: { id },
      data: {
        aprobado,
        estado: aprobado ? ResenaState.APROBADA : ResenaState.RECHAZADA,
      },
    });
  }

  async remove(id: number) {
    const resena = await this.prisma.resena.findUnique({ where: { id } });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }
    return this.prisma.resena.delete({ where: { id } });
  }
}
