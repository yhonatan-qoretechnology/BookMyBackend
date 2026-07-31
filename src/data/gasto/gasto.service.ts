import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

import { compressChatImageInPlace } from 'src/data/chatMessage/chat-image-compressor';
import { AccessControlService } from 'src/auth/services/access-control/access-control.service';
import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { SftpStorageService } from 'src/storage/sftp-storage.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { GASTO_UPLOAD_DIR } from './gasto-file.constants';

type GastoFilters = {
  sedeId?: number;
  empresaId?: number;
};

@Injectable()
export class GastoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sftpStorage: SftpStorageService,
    private readonly accessControlService: AccessControlService,
  ) {}

  private gastoInclude() {
    return {
      categoria: true,
      sede: { select: { id: true, nombre: true } },
      user: { select: { id: true, email: true } },
    };
  }

  /**
   * Resolves the sede scope a user is allowed to see, ignoring any
   * client-supplied sedeId/empresaId that falls outside their AdminProfile.
   */
  private async resolveSedeScope(
    user: AuthenticatedUser,
    filters: GastoFilters,
  ): Promise<Prisma.GastoWhereInput> {
    if (user.role === Role.SUPER_ADMIN) {
      if (filters.sedeId) {
        return { sedeId: filters.sedeId };
      }

      if (filters.empresaId) {
        const sedes = await this.prisma.sede.findMany({
          where: { empresaId: filters.empresaId },
          select: { id: true },
        });
        return { sedeId: { in: sedes.map((sede) => sede.id) } };
      }

      return {};
    }

    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId) {
        throw new ForbiddenException(
          'No se encontró la empresa asociada al administrador.',
        );
      }

      if (filters.sedeId) {
        await this.accessControlService.ensureSedeAccessForUser(
          filters.sedeId,
          user,
        );
        return { sedeId: filters.sedeId };
      }

      const sedes = await this.prisma.sede.findMany({
        where: { empresaId: user.empresaId },
        select: { id: true },
      });
      return { sedeId: { in: sedes.map((sede) => sede.id) } };
    }

    if (!user.sedeId) {
      throw new ForbiddenException(
        'No se encontró la sede asociada al administrador.',
      );
    }

    return { sedeId: user.sedeId };
  }

  async filterGastos(user: AuthenticatedUser, filters: GastoFilters) {
    const sedeScope = await this.resolveSedeScope(user, filters);

    return this.prisma.gasto.findMany({
      where: sedeScope,
      include: this.gastoInclude(),
      orderBy: { fecha: 'desc' },
    });
  }

  async createGasto(dto: CreateGastoDto, user: AuthenticatedUser) {
    await this.accessControlService.ensureSedeAccessForUser(
      dto.sedeId,
      user,
    );

    try {
      return await this.prisma.gasto.create({
        data: {
          descripcion: dto.descripcion,
          total: dto.total,
          fecha: new Date(dto.fecha),
          categoriaId: dto.categoriaId,
          sedeId: dto.sedeId,
          ticketUrl: dto.ticketUrl,
          userId: user.userId,
        },
        include: this.gastoInclude(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'La sede o categoría indicada no existe.',
        );
      }
      throw error;
    }
  }

  async updateGasto(id: number, dto: UpdateGastoDto, user: AuthenticatedUser) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id } });

    if (!gasto) {
      throw new NotFoundException('Gasto no encontrado.');
    }

    await this.accessControlService.ensureSedeAccessForUser(
      gasto.sedeId,
      user,
    );

    try {
      return await this.prisma.gasto.update({
        where: { id },
        data: {
          ...(dto.descripcion !== undefined && {
            descripcion: dto.descripcion,
          }),
          ...(dto.total !== undefined && { total: dto.total }),
          ...(dto.fecha !== undefined && { fecha: new Date(dto.fecha) }),
          ...(dto.categoriaId !== undefined && {
            categoriaId: dto.categoriaId,
          }),
          ...(dto.ticketUrl !== undefined && { ticketUrl: dto.ticketUrl }),
        },
        include: this.gastoInclude(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('La categoría indicada no existe.');
      }
      throw error;
    }
  }

  async removeGasto(id: number, user: AuthenticatedUser) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id } });

    if (!gasto) {
      throw new NotFoundException('Gasto no encontrado.');
    }

    await this.accessControlService.ensureSedeAccessForUser(
      gasto.sedeId,
      user,
    );

    return this.prisma.gasto.delete({ where: { id } });
  }

  /**
   * Move an uploaded ticket to its final storage location (SFTP or local
   * `uploads/gastos`) and return its public URL, compressing images in
   * place like the chat attachments flow.
   */
  private async persistGastoAttachment(file: Express.Multer.File) {
    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const relativePath = path
      .join('uploads', GASTO_UPLOAD_DIR, finalFileName)
      .replace(/\\/g, '/');

    const tempAbsPath = path.isAbsolute(file.path)
      ? file.path
      : path.join(process.cwd(), file.path);

    const compressedSize = await compressChatImageInPlace(
      tempAbsPath,
      file.mimetype,
    );
    const sizeBytes = compressedSize ?? file.size;

    if (this.sftpStorage.isEnabled()) {
      const { publicUrl } = await this.sftpStorage.uploadLocalFile({
        localPath: file.path,
        remoteRelativePath: relativePath,
        deleteLocalAfter: true,
      });

      return { fileUrl: publicUrl, sizeBytes };
    }

    const uploadDirAbs = path.join(process.cwd(), 'uploads', GASTO_UPLOAD_DIR);
    if (!fs.existsSync(uploadDirAbs)) {
      fs.mkdirSync(uploadDirAbs, { recursive: true });
    }

    const finalAbsPath = path.join(uploadDirAbs, finalFileName);

    if (tempAbsPath !== finalAbsPath) {
      fs.renameSync(tempAbsPath, finalAbsPath);
    }

    const baseUrl = (
      this.configService.get<string>('UPLOADS_PUBLIC_BASE_URL') ?? ''
    )
      .trim()
      .replace(/\/+$/g, '');

    const fileUrl = baseUrl ? `${baseUrl}/${relativePath}` : `/${relativePath}`;

    return { fileUrl, sizeBytes };
  }

  async storeGastoFile(file: Express.Multer.File) {
    const { fileUrl, sizeBytes } = await this.persistGastoAttachment(file);

    return {
      fileUrl,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes,
    };
  }
}
