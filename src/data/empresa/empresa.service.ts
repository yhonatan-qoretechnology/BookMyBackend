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

  /**
   * El país del negocio se resuelve por su código ISO. Es obligatorio en la
   * base, así que sin él se asume España: es lo que eran todas las empresas
   * antes de que Bookmy operase en más de un país.
   */
  private async resolverPais(isoCode?: string): Promise<number> {
    const iso = (isoCode?.trim() || 'ES').toUpperCase();
    const pais = await this.prisma.country.findUnique({
      where: { isoCode: iso },
      select: { id: true },
    });
    if (!pais) {
      throw new BadRequestException(`Todavía no operamos en el país ${iso}.`);
    }
    return pais.id;
  }

  async create(createEmpresaDto: CreateEmpresaDto, file?: Express.Multer.File) {
    const logoUrl = file ? await this.storeLogo(file) : null;
    const { paisIso, ...datos } = createEmpresaDto;
    const countryId = await this.resolverPais(paisIso);

    try {
      return await this.prisma.empresa.create({
        data: {
          ...datos,
          countryId,
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
    /* Con el pais incluido: la lista de empresas del SUPER_ADMIN ensena de
       que mercado es cada negocio, que es lo que hace que un solo panel
       siga siendo mejor que dos. */
    return this.prisma.empresa.findMany({ include: { country: true } });
  }

  async findOne(id: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      /* El pais viaja siempre con la empresa: el panel se configura con el
         -moneda, huso, formatos y etiquetas- y sin el se quedaria en euros. */
      include: { country: true },
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

  // 🔒 Bloquear una empresa (solo SUPER_ADMIN, ver guard en el controller):
  // no borra nada, solo impide login de sus admins/profesionales y que se
  // reserve en sus sedes (ver AuthService.login() y AppointmentService.create()).
  async bloquear(id: number, motivo?: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    return this.prisma.empresa.update({
      where: { id },
      data: {
        bloqueada: true,
        bloqueadaEn: new Date(),
        bloqueadaMotivo: motivo?.trim() || null,
      },
    });
  }

  async desbloquear(id: number) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada.`);
    }

    return this.prisma.empresa.update({
      where: { id },
      data: {
        bloqueada: false,
        bloqueadaEn: null,
        bloqueadaMotivo: null,
      },
    });
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
