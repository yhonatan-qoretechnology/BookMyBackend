import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { SftpStorageService } from '../../storage/sftp-storage.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(
    private prisma: PrismaService,
    private readonly sftpStorage: SftpStorageService,
  ) {}

  private moveLogoToFinalPath(file: Express.Multer.File) {
    const uploadDirAbs = path.join(process.cwd(), 'uploads', 'logos');
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

    return path.join('uploads', 'logos', finalFileName).replace(/\\/g, '/');
  }

  private async storeLogo(file: Express.Multer.File) {
    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const relativePath = path
      .join('uploads', 'logos', finalFileName)
      .replace(/\\/g, '/');

    if (this.sftpStorage.isEnabled()) {
      await this.sftpStorage.uploadLocalFile({
        localPath: file.path,
        remoteRelativePath: relativePath,
        deleteLocalAfter: true,
      });
      return relativePath;
    }

    return this.moveLogoToFinalPath(file);
  }

  private safeDeleteIfExists(filePath: string) {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (error) {
        console.error(`Error al eliminar archivo: ${absPath}`, error);
      }
    }
  }

  private async safeDeleteRemoteOrLocal(filePath: string) {
    if (!filePath) return;
    if (this.sftpStorage.isEnabled()) {
      try {
        const normalized = filePath.trim();
        if (/^https?:\/\//i.test(normalized)) {
          await this.sftpStorage.deleteByPublicUrl(normalized);
          return;
        }

        const relative = normalized.replace(/^\/+/, '');
        await this.sftpStorage.deleteByRelativePath(relative);
        return;
      } catch (error) {
        console.error(`Error al eliminar archivo remoto: ${filePath}`, error);
      }
    }

    this.safeDeleteIfExists(filePath);
  }

  async create(createEmpresaDto: CreateEmpresaDto, file?: Express.Multer.File) {
    const logoUrl = file ? await this.storeLogo(file) : null;

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
            await this.safeDeleteRemoteOrLocal(logoUrl ?? file.path);
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
    file?: Express.Multer.File,
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
    });
    if (!empresa) {
      if (file) {
        this.safeDeleteIfExists(file.path);
      }
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    const updateData: Prisma.EmpresaUpdateInput = {
      ...updateEmpresaDto,
    };
    if (file) {
      const newLogoPath = await this.storeLogo(file);
      updateData.logo = newLogoPath;
      if (empresa.logo && empresa.logo !== newLogoPath) {
        await this.safeDeleteRemoteOrLocal(empresa.logo);
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
            this.safeDeleteIfExists(file.path);
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
      await this.safeDeleteRemoteOrLocal(empresa.logo);
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
      this.safeDeleteIfExists(file.path);
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    const newLogoPath = await this.storeLogo(file);

    try {
      const updated = await this.prisma.empresa.update({
        where: { id },
        data: {
          logo: newLogoPath,
        },
      });

      if (empresa.logo && empresa.logo !== newLogoPath) {
        await this.safeDeleteRemoteOrLocal(empresa.logo);
      }

      return updated;
    } catch (error) {
      // Si algo falla, intentamos limpiar el archivo que se subió
      await this.safeDeleteRemoteOrLocal(newLogoPath);

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
