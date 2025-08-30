import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { UpdateProfesionalDto } from './dto/update-profesional.dto';

@Injectable()
export class ProfesionalService {
  constructor(private prisma: PrismaService) {}

  async create(
    createProfesionalDto: CreateProfesionalDto,
    file?: Express.Multer.File,
  ) {
    // 1. Verificar si la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { id: createProfesionalDto.sedeId },
    });
    if (!sede) {
      if (file) {
        fs.unlinkSync(file.path);
      }
      throw new NotFoundException(
        `Sede con ID ${createProfesionalDto.sedeId} no encontrada.`,
      );
    }

    try {
      let imagenPath: string | undefined;

      // 2. Si se subió un archivo, moverlo al directorio final
      if (file) {
        const uploadDir = path.join('./uploads/profesionales');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        imagenPath = path.join(uploadDir, file.filename);
        fs.renameSync(file.path, imagenPath);
      }

      // 3. Crear el profesional en la base de datos
      const profesional = await this.prisma.profesional.create({
        data: {
          ...createProfesionalDto,
          imagen: imagenPath,
        },
      });

      return profesional;
    } catch (error) {
      // 4. Limpiar el archivo si algo falla
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      // 5. Manejar errores de Prisma, por ejemplo, teléfono duplicado
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'El número de teléfono ya está en uso.',
          );
        }
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.profesional.findMany();
  }

  async findOne(id: number) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }
    return profesional;
  }

  async update(id: number, updateProfesionalDto: UpdateProfesionalDto) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    return this.prisma.profesional.update({
      where: { id },
      data: updateProfesionalDto,
    });
  }

  async updateImage(id: number, file: Express.Multer.File) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });

    if (!profesional) {
      fs.unlinkSync(file.path); // Elimina la imagen subida si el profesional no existe
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    // 1. Eliminar la imagen antigua si existe
    if (profesional.imagen && fs.existsSync(profesional.imagen)) {
      fs.unlinkSync(profesional.imagen);
    }

    // 2. Mover la nueva imagen de la carpeta temporal a la final
    const uploadDir = path.join('./uploads/profesionales');
    const finalPath = path.join(uploadDir, file.filename);
    fs.renameSync(file.path, finalPath);

    // 3. Actualizar la ruta de la imagen en la base de datos
    return this.prisma.profesional.update({
      where: { id },
      data: {
        imagen: finalPath,
      },
    });
  }

  async remove(id: number) {
    const profesional = await this.prisma.profesional.findUnique({
      where: { id },
    });
    if (!profesional) {
      throw new NotFoundException(`Profesional con ID ${id} no encontrado.`);
    }

    if (profesional.imagen && fs.existsSync(profesional.imagen)) {
      fs.unlinkSync(profesional.imagen);
    }
    return this.prisma.profesional.delete({ where: { id } });
  }
}
