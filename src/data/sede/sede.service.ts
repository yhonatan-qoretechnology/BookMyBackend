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
          // NestJS ya ha convertido los campos JSON a objetos/arrays nativos.
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

  async findAll() {
    return this.prisma.sede.findMany();
  }

  async findOne(id: number) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
    });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }
    return sede;
  }

  async update(id: number, updateSedeDto: UpdateSedeDto) {
    const sede = await this.prisma.sede.findUnique({ where: { id } });
    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada.`);
    }

    // La data ya está en el formato correcto, no es necesario parsear
    return this.prisma.sede.update({
      where: { id },
      data: updateSedeDto,
    });
  }

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
