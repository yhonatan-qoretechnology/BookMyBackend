import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@Injectable()
export class SedeService {
  constructor(private prisma: PrismaService) {}

  // 🔹 Crear una nueva sede
  async create(createSedeDto: CreateSedeDto, files: Express.Multer.File[]) {
    try {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: createSedeDto.empresaId },
      });
      if (!empresa) {
        throw new NotFoundException(
          `Empresa con ID ${createSedeDto.empresaId} no encontrada.`,
        );
      }

      const sede = await this.prisma.sede.create({
        data: {
          ...createSedeDto,
        },
      });

      const finalDir = path.join('./uploads/sedes', sede.id.toString());
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }

      const imagenesUrls = files.map((file) => {
        const newFileName = `${Date.now()}-${file.originalname}`;
        const finalPath = path.join(finalDir, newFileName);
        fs.renameSync(file.path, finalPath);
        return finalPath;
      });

      return await this.prisma.sede.update({
        where: { id: sede.id },
        data: { imagenes: imagenesUrls },
      });
    } catch (error) {
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Ya existe una sede con el mismo nombre.',
          );
        }
      }
      throw error;
    }
  }

  // 🔹 Obtener todas las sedes
  async findAll() {
    return this.prisma.sede.findMany({
      include: {
        Service: true, // incluir los servicios asociados
      },
    });
  }

  // 🔹 Obtener una sede específica
  async findOne(id: number) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        Service: true, // incluir los servicios asociados
      },
    });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }
    return sede;
  }

  // 🔹 Actualizar datos de la sede
  async update(id: number, updateSedeDto: UpdateSedeDto) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    return this.prisma.sede.update({
      where: { id },
      data: updateSedeDto,
    });
  }

  // 🔹 Eliminar una sede
  async remove(id: number) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    const sedeDir = path.join('./uploads/sedes', sede.id.toString());
    if (fs.existsSync(sedeDir)) {
      fs.rmSync(sedeDir, { recursive: true, force: true });
    }

    return this.prisma.sede.delete({ where: { id } });
  }

  // 🔹 Agregar una sola imagen
  async addImageToSede(id: number, file: Express.Multer.File) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
    });
    if (!sede) {
      fs.unlinkSync(file.path);
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    const finalDir = path.join('./uploads/sedes', sede.id.toString());
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const finalPath = path.join(finalDir, file.filename);
    fs.renameSync(file.path, finalPath);

    return this.prisma.sede.update({
      where: { id },
      data: {
        imagenes: {
          push: finalPath,
        },
      },
    });
  }

  // 🔹 Agregar múltiples imágenes
  async addImagesToGaleria(id: number, files: Express.Multer.File[]) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      this.deleteTempFiles(files);
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    const finalDir = path.join('./uploads/sedes', sede.id.toString());
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const newImagePaths: string[] = [];
    files.forEach((file) => {
      const newFileName = `${Date.now()}-${file.originalname}`;
      const finalPath = path.join(finalDir, newFileName);
      fs.renameSync(file.path, finalPath);
      newImagePaths.push(finalPath);
    });

    return await this.prisma.sede.update({
      where: { id },
      data: {
        imagenes: {
          push: newImagePaths,
        },
      },
    });
  }

  // 🔹 Asociar servicios a una sede
  async addServicesToSede(sedeId: number, serviceIds: number[]) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }

    // Verificar que los servicios existan
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });

    if (services.length !== serviceIds.length) {
      const missingIds = serviceIds.filter(
        (id) => !services.find((s) => s.id === id),
      );
      throw new NotFoundException(
        `Servicios no encontrados: ${missingIds.join(', ')}`,
      );
    }

    return this.prisma.sede.update({
      where: { id: sedeId },
      data: {
        Service: {
          connect: serviceIds.map((id) => ({ id })),
        },
      },
      include: {
        Service: true,
      },
    });
  }

  // 🔹 Eliminar servicios asociados de una sede
  async removeServicesFromSede(sedeId: number, serviceIds: number[]) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }

    return this.prisma.sede.update({
      where: { id: sedeId },
      data: {
        Service: {
          disconnect: serviceIds.map((id) => ({ id })),
        },
      },
      include: {
        Service: true,
      },
    });
  }

  // 🔹 Obtener servicios de una sede
  async getServicesBySede(sedeId: number) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      include: { Service: true },
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada.`);
    }

    return sede.Service;
  }

  // 🔹 Utilidad para limpiar archivos temporales
  private deleteTempFiles(files: Express.Multer.File[]) {
    if (files && files.length > 0) {
      files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
  }
}
