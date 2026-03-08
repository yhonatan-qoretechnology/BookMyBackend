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

  private moveSedeFileToFinalPath(sedeId: number, file: Express.Multer.File) {
    const uploadDirAbs = path.join(
      process.cwd(),
      'uploads',
      'sedes',
      sedeId.toString(),
    );
    if (!fs.existsSync(uploadDirAbs)) {
      fs.mkdirSync(uploadDirAbs, { recursive: true });
    }

    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const finalAbsPath = path.join(uploadDirAbs, finalFileName);

    const tempAbsPath = path.isAbsolute(file.path)
      ? file.path
      : path.join(process.cwd(), file.path);

    if (tempAbsPath !== finalAbsPath) {
      fs.renameSync(tempAbsPath, finalAbsPath);
    }

    return path
      .join('uploads', 'sedes', sedeId.toString(), finalFileName)
      .replace(/\\/g, '/');
  }

  private safeDeleteSedeFile(filePath: string) {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (error) {
        console.error(`Error al eliminar archivo de sede: ${absPath}`, error);
      }
    }
  }

  // 🔹 Crear una nueva sede
  async create(createSedeDto: CreateSedeDto, files?: Express.Multer.File[]) {
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

      let imagenesUrls: string[] = [];
      if (files && files.length > 0) {
        imagenesUrls = files.map((file) =>
          this.moveSedeFileToFinalPath(sede.id, file),
        );
      }

      return await this.prisma.sede.update({
        where: { id: sede.id },
        data: { imagenes: imagenesUrls },
      });
    } catch (error) {
      if (files && files.length > 0) {
        files.forEach((file) => {
          this.safeDeleteSedeFile(file.path);
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

  // 🔹 Obtener todas las sedes de una empresa
  async findByEmpresa(empresaId: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${empresaId} no encontrada.`);
    }

    return this.prisma.sede.findMany({
      where: { empresaId },
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
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      this.safeDeleteSedeFile(file.path);
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    const finalPublicPath = this.moveSedeFileToFinalPath(id, file);

    return this.prisma.sede.update({
      where: { id },
      data: {
        imagenes: {
          push: finalPublicPath,
        },
      },
    });
  }

  // 🔹 Agregar múltiples imágenes
  async addImagesToGaleria(id: number, files: Express.Multer.File[]) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      files.forEach((f) => this.safeDeleteSedeFile(f.path));
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    const newImagePaths = files.map((file) =>
      this.moveSedeFileToFinalPath(id, file),
    );

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

  // 🔹 Eliminar imágenes específicas de una sede
  async removeImagesFromSede(id: number, imagenesParaEliminar: string[]) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    const imagenesActuales = sede.imagenes || [];
    const nuevasImagenes = imagenesActuales.filter(
      (img) => !imagenesParaEliminar.includes(img),
    );

    // Eliminar archivos físicos
    imagenesParaEliminar.forEach((imgPath) => {
      if (imagenesActuales.includes(imgPath)) {
        this.safeDeleteSedeFile(imgPath);
      }
    });

    return await this.prisma.sede.update({
      where: { id },
      data: {
        imagenes: nuevasImagenes,
      },
    });
  }
}
