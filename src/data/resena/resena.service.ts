import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResenaType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResenaDto } from './dto/create-resena.dto';
import { UpdateResenaDto } from './dto/update-resena.dto';

@Injectable()
export class ResenaService {
  constructor(private prisma: PrismaService) {}

  async create(createResenaDto: CreateResenaDto) {
    if (createResenaDto.tipo === ResenaType.SEDE) {
      if (createResenaDto.serviceId) {
        throw new BadRequestException(
          'Una reseña de tipo SEDE no puede tener un serviceId.',
        );
      }
      if (createResenaDto.sedeId == null) {
        throw new BadRequestException(
          'Una reseña de tipo SEDE debe tener un sedeId.',
        );
      }
    } else if (createResenaDto.tipo === ResenaType.SERVICIO) {
      if (createResenaDto.serviceId == null) {
        throw new BadRequestException(
          'Una reseña de tipo SERVICIO debe tener un serviceId.',
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
    if (createResenaDto.tipo === ResenaType.SEDE) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: createResenaDto.sedeId },
      });
      if (!sede) {
        throw new NotFoundException(
          `Sede con ID ${createResenaDto.sedeId} no encontrada.`,
        );
      }
    } else {
      const service = await this.prisma.service.findUnique({
        where: { id: createResenaDto.serviceId },
      });
      if (!service) {
        throw new NotFoundException(
          `Servicio con ID ${createResenaDto.serviceId} no encontrado.`,
        );
      }
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
    }

    return this.prisma.resena.create({
      data: createResenaDto,
    });
  }

  async findAll() {
    return this.prisma.resena.findMany({
      include: {
        sede: true,
        service: true,
        usuario: true,
      },
    });
  }

  async findOne(id: number) {
    const resena = await this.prisma.resena.findUnique({
      where: { id },
      include: {
        sede: true,
        service: true,
        usuario: true,
      },
    });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }
    return resena;
  }

  async findBySede(sedeId: number) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }

    return this.prisma.resena.findMany({
      where: { sedeId },
      include: {
        sede: true,
        service: true,
        usuario: true,
      },
    });
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
    const targetServiceId =
      updateResenaDto.serviceId !== undefined
        ? updateResenaDto.serviceId
        : resena.serviceId;

    if (targetType === ResenaType.SEDE) {
      if (targetServiceId != null) {
        throw new BadRequestException(
          'Una reseña de tipo SEDE no puede tener un serviceId.',
        );
      }
      if (targetSedeId == null) {
        throw new BadRequestException(
          'Una reseña de tipo SEDE debe tener un sedeId.',
        );
      }
    }

    if (targetType === ResenaType.SERVICIO) {
      if (targetServiceId == null) {
        throw new BadRequestException(
          'Una reseña de tipo SERVICIO debe tener un serviceId.',
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

    if (
      targetType === ResenaType.SERVICIO &&
      updateResenaDto.serviceId !== undefined
    ) {
      const service = await this.prisma.service.findUnique({
        where: { id: updateResenaDto.serviceId },
      });
      if (!service) {
        throw new NotFoundException(
          `Servicio con ID ${updateResenaDto.serviceId} no encontrado.`,
        );
      }
    }

    if (targetType === ResenaType.SERVICIO && updateResenaDto.sedeId != null) {
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

  async remove(id: number) {
    const resena = await this.prisma.resena.findUnique({ where: { id } });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }
    return this.prisma.resena.delete({ where: { id } });
  }
}
