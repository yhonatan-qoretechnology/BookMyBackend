import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(private prisma: PrismaService) {}

  async create(
    createServiceDto: CreateServiceDto,
    files?: Express.Multer.File[],
  ) {
    // 1. Verificar que la categoría exista
    const category = await this.prisma.category.findUnique({
      where: { id: createServiceDto.categoryId },
    });
    if (!category) {
      if (files && files.length > 0) {
        files.forEach((file) => fs.unlinkSync(file.path));
      }
      throw new NotFoundException(
        `Categoría con ID ${createServiceDto.categoryId} no encontrada.`,
      );
    }

    // 2. Verificar que las sedes existan
    if (createServiceDto.sedeIds && createServiceDto.sedeIds.length > 0) {
      const sedes = await this.prisma.sede.findMany({
        where: { id: { in: createServiceDto.sedeIds } },
      });
      if (sedes.length !== createServiceDto.sedeIds.length) {
        if (files && files.length > 0) {
          files.forEach((file) => fs.unlinkSync(file.path));
        }
        throw new NotFoundException('Una o más sedes no fueron encontradas.');
      }
    }

    // 3. Verificar que los profesionales existan
    if (
      createServiceDto.profesionalesIds &&
      createServiceDto.profesionalesIds.length > 0
    ) {
      const profesionales = await this.prisma.profesional.findMany({
        where: { id: { in: createServiceDto.profesionalesIds } },
      });
      if (profesionales.length !== createServiceDto.profesionalesIds.length) {
        if (files && files.length > 0) {
          files.forEach((file) => fs.unlinkSync(file.path));
        }
        throw new NotFoundException(
          'Uno o más profesionales no fueron encontrados.',
        );
      }
    }

    try {
      const uploadDir = path.join('./uploads/servicios');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const imagenesPaths = files?.map((file) => {
        const finalPath = path.join(uploadDir, file.filename);
        fs.renameSync(file.path, finalPath);
        return finalPath;
      });

      const pricesWithDuration = createServiceDto.prices.map((price) => ({
        ...price,
        duration: price.duration ?? 0,
      }));

      const service = await this.prisma.service.create({
        data: {
          categoryId: createServiceDto.categoryId,
          translations: {
            create: createServiceDto.translations,
          },
          prices: {
            create:
              pricesWithDuration as Prisma.PriceCreateWithoutServiceInput[],
          },
          imagenes: imagenesPaths,
          sedes: {
            create: createServiceDto.sedeIds?.map((sedeId) => ({
              sede: { connect: { id: sedeId } },
            })),
          },
          profesionales: {
            connect: createServiceDto.profesionalesIds?.map(
              (profesionalId) => ({
                id: profesionalId,
              }),
            ),
          },
        },
      });
      return service;
    } catch (error) {
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.service.findMany({
      include: {
        category: true,
        translations: true,
        prices: true,
        sedes: {
          include: {
            sede: true,
          },
        },
        profesionales: true,
      },
    });
  }

  async findOne(id: number) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        translations: true,
        prices: true,
        sedes: {
          include: {
            sede: true,
          },
        },
        profesionales: true,
      },
    });
    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado.`);
    }
    return service;
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado.`);
    }

    const pricesWithDuration = updateServiceDto.prices?.map((price) => ({
      ...price,
      duration: price.duration ?? 0,
    }));

    return this.prisma.service.update({
      where: { id },
      data: {
        categoryId: updateServiceDto.categoryId,
        translations: {
          deleteMany: {},
          create: updateServiceDto.translations,
        },
        prices: {
          deleteMany: {},
          create: pricesWithDuration as Prisma.PriceCreateWithoutServiceInput[],
        },
        sedes: {
          deleteMany: {},
          create: updateServiceDto.sedeIds?.map((sedeId) => ({
            sede: { connect: { id: sedeId } },
          })),
        },
        profesionales: {
          set: updateServiceDto.profesionalesIds?.map((profesionalId) => ({
            id: profesionalId,
          })),
        },
      },
    });
  }

  async remove(id: number) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado.`);
    }
    if (service.imagenes && service.imagenes.length > 0) {
      service.imagenes.forEach((imagenPath) => {
        if (fs.existsSync(imagenPath)) {
          fs.unlinkSync(imagenPath);
        }
      });
    }

    return this.prisma.service.delete({ where: { id } });
  }
}
