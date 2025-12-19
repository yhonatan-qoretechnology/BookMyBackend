import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}

  async create(createEmpresaDto: CreateEmpresaDto, file: Express.Multer.File) {
    const logoUrl = file ? file.path : null;

    try {
      return await this.prisma.empresa.create({
        data: {
          ...createEmpresaDto,
          logo: logoUrl,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          if (file) {
            fs.unlinkSync(file.path);
          }
          throw new BadRequestException(
            'El nombre de la empresa ya está en uso.',
          );
        }
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.empresa.findMany();
  }

  async findOne(id: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
    });
    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }
    return empresa;
  }

  async update(
    id: number,
    updateEmpresaDto: UpdateEmpresaDto,
    file: Express.Multer.File,
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
    });
    if (!empresa) {
      if (file) {
        fs.unlinkSync(file.path);
      }
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    const updateData: Prisma.EmpresaUpdateInput = {
      ...updateEmpresaDto,
    };
    if (file) {
      updateData.logo = file.path;
      if (empresa.logo) {
        try {
          fs.unlinkSync(empresa.logo);
        } catch (error) {
          console.error(
            `Error al eliminar el logo anterior: ${empresa.logo}`,
            error,
          );
        }
      }
    }

    try {
      return await this.prisma.empresa.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          if (file) {
            fs.unlinkSync(file.path);
          }
          throw new BadRequestException(
            'El nombre de la empresa ya está en uso.',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
    });
    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    if (empresa.logo) {
      try {
        fs.unlinkSync(empresa.logo);
      } catch (error) {
        console.error(`Error al eliminar el logo: ${empresa.logo}`, error);
      }
    }

    await this.prisma.empresa.delete({
      where: { id },
    });
    return { message: `Empresa con ID ${id} eliminada correctamente.` };
  }

  async updateLogo(id: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo de logo.');
    }

    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      fs.unlinkSync(file.path);
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    const newLogoPath = file.path;

    try {
      const updated = await this.prisma.empresa.update({
        where: { id },
        data: {
          logo: newLogoPath,
        },
      });

      if (empresa.logo && empresa.logo !== newLogoPath) {
        try {
          fs.unlinkSync(empresa.logo);
        } catch (error) {
          console.error(
            `Error al eliminar el logo anterior: ${empresa.logo}`,
            error,
          );
        }
      }

      return updated;
    } catch (error) {
      fs.unlinkSync(file.path);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'El nombre de la empresa ya está en uso.',
          );
        }
      }

      throw error;
    }
  }
}
