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
    // Validar que se ha proporcionado un ID de sede o servicio, pero no ambos
    if (createResenaDto.tipo === ResenaType.SEDE && createResenaDto.serviceId) {
      throw new BadRequestException(
        'Una reseña de tipo SEDE no puede tener un serviceId.',
      );
    }
    if (
      createResenaDto.tipo === ResenaType.SERVICIO &&
      createResenaDto.sedeId
    ) {
      throw new BadRequestException(
        'Una reseña de tipo SERVICIO no puede tener un sedeId.',
      );
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

  async update(id: number, updateResenaDto: UpdateResenaDto) {
    const resena = await this.prisma.resena.findUnique({ where: { id } });
    if (!resena) {
      throw new NotFoundException(`Reseña con ID ${id} no encontrada.`);
    }

    // Validar la lógica de sede/servicio si el tipo o los IDs se actualizan
    if (
      (updateResenaDto.tipo || resena.tipo) === ResenaType.SEDE &&
      updateResenaDto.serviceId
    ) {
      throw new BadRequestException(
        'Una reseña de tipo SEDE no puede tener un serviceId.',
      );
    }
    if (
      (updateResenaDto.tipo || resena.tipo) === ResenaType.SERVICIO &&
      updateResenaDto.sedeId
    ) {
      throw new BadRequestException(
        'Una reseña de tipo SERVICIO no puede tener un sedeId.',
      );
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

    if (
      (updateResenaDto.tipo || resena.tipo) === ResenaType.SEDE &&
      updateResenaDto.sedeId !== undefined
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

    if (
      (updateResenaDto.tipo || resena.tipo) === ResenaType.SERVICIO &&
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
