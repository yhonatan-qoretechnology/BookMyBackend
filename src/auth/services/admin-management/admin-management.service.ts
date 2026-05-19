import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientState, ClientType, Prisma, Role } from '@prisma/client';
import * as path from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { SftpStorageService } from '../../../storage/sftp-storage.service';
import { CreateAdminUserDto } from '../../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../../dto/update-admin-user.dto';
import { AuthenticatedUser } from '../../types/authenticated-user.interface';
import { HashService } from '../hash/hash.service';

interface AdminCreationParams {
  dto: CreateAdminUserDto;
  role: Role;
  empresaId: number;
  sedeId?: number | null;
}

@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: HashService,
    private readonly sftpStorage: SftpStorageService,
  ) {}

  private async storeAdminImage(file: Express.Multer.File) {
    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${Date.now()}-${file.filename}${ext}`;
    const relativePath = path
      .join('uploads', 'users', finalFileName)
      .replace(/\\/g, '/');

    if (this.sftpStorage.isEnabled()) {
      await this.sftpStorage.uploadLocalFile({
        localPath: file.path,
        remoteRelativePath: relativePath,
        deleteLocalAfter: true,
      });
      return relativePath;
    }

    const userUploadsDir = path.join(process.cwd(), 'uploads', 'users');
    const fs = require('fs');
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }
    const finalPath = path.join(userUploadsDir, finalFileName);
    fs.renameSync(file.path, finalPath);
    return finalPath.replace(/\\/g, '/');
  }

  private async deleteAdminImage(filePath: string) {
    if (!filePath) return;
    if (this.sftpStorage.isEnabled()) {
      try {
        const normalized = filePath.trim();
        await this.sftpStorage.deleteByRelativePath(normalized);
      } catch (error) {
        console.error('Error deleting remote image:', error);
      }
      return;
    }
    const fs = require('fs');
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async listAdmins(user: AuthenticatedUser) {
    const baseWhere: Prisma.UsersWhereInput = {
      role: { in: [Role.COMPANY_ADMIN, Role.BRANCH_ADMIN, Role.EMPLOYEE] },
      AdminProfile: { isNot: null },
    };

    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.users.findMany({
        where: baseWhere,
        include: { UserData: true, AdminProfile: true },
        orderBy: { id: 'desc' },
      });
    }

    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId) {
        throw new ForbiddenException(
          'No se encontró la empresa asociada al administrador.',
        );
      }

      return this.prisma.users.findMany({
        where: {
          ...baseWhere,
          AdminProfile: { is: { empresaId: user.empresaId } },
        },
        include: { UserData: true, AdminProfile: true },
        orderBy: { id: 'desc' },
      });
    }

    if (user.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId) {
        throw new ForbiddenException(
          'No se encontró la sede asociada al administrador.',
        );
      }

      return this.prisma.users.findMany({
        where: {
          ...baseWhere,
          AdminProfile: { is: { sedeId: user.sedeId } },
        },
        include: { UserData: true, AdminProfile: true },
        orderBy: { id: 'desc' },
      });
    }

    throw new ForbiddenException(
      'No tiene permisos para listar administradores.',
    );
  }

  async getAdminByUserId(userId: number, user: AuthenticatedUser) {
    const target = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { UserData: true, AdminProfile: true },
    });

    if (!target) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    if (!target.AdminProfile) {
      throw new NotFoundException(
        `El usuario con ID ${userId} no tiene perfil de administrador.`,
      );
    }

    if (
      target.role !== Role.COMPANY_ADMIN &&
      target.role !== Role.BRANCH_ADMIN
    ) {
      throw new BadRequestException(
        'El usuario indicado no es un administrador.',
      );
    }

    this.ensureAdminScopeAccess(target.AdminProfile, user);
    return target;
  }

  async updateAdminByUserId(
    userId: number,
    dto: UpdateAdminUserDto,
    user: AuthenticatedUser,
    photoFile?: Express.Multer.File,
  ) {
    const target = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { AdminProfile: true, UserData: true },
    });

    if (!target) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    if (!target.AdminProfile) {
      throw new NotFoundException(
        `El usuario con ID ${userId} no tiene perfil de administrador.`,
      );
    }

    if (
      target.role !== Role.COMPANY_ADMIN &&
      target.role !== Role.BRANCH_ADMIN
    ) {
      throw new BadRequestException(
        'El usuario indicado no es un administrador.',
      );
    }

    this.ensureAdminScopeAccess(target.AdminProfile, user);

    if (
      user.role === Role.COMPANY_ADMIN &&
      target.role === Role.COMPANY_ADMIN
    ) {
      // permitido (mismo alcance por empresa) - no hacer nada extra
    }

    const userDataUpdate: Prisma.UserDataUpdateInput = {};
    const userDataCreate: Prisma.UserDataCreateInput = {
      user: { connect: { id: userId } },
      name: target.email || '',
      email: target.email,
      phone: '',
      idioma: '',
      gender: '',
    } as Prisma.UserDataCreateInput;
    if (dto.phone !== undefined) {
      userDataUpdate.phone = dto.phone;
      userDataCreate.phone = dto.phone;
    }
    if (dto.idioma !== undefined) {
      userDataUpdate.idioma = dto.idioma;
      userDataCreate.idioma = dto.idioma;
    }
    if (dto.gender !== undefined) {
      userDataUpdate.gender = dto.gender;
      userDataCreate.gender = dto.gender;
    }
    if (dto.countryId !== undefined && dto.countryId !== null) {
      userDataUpdate.country = { connect: { id: dto.countryId } };
      userDataCreate.country = { connect: { id: dto.countryId } };
    }
    if (dto.birthdate !== undefined) {
      const birthdate = dto.birthdate ? new Date(dto.birthdate) : null;
      userDataUpdate.birthdate = birthdate;
      userDataCreate.birthdate = birthdate;
    }

    const adminProfileUpdate: Prisma.AdminProfileUpdateInput = {};
    if (dto.firstName !== undefined)
      adminProfileUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) adminProfileUpdate.lastName = dto.lastName;
    if (dto.phone !== undefined) adminProfileUpdate.phone = dto.phone;
    if (dto.photoFile !== undefined && dto.photoFile !== null) {
      const oldPhotoUrl = target.AdminProfile?.photoUrl;
      if (oldPhotoUrl) {
        await this.deleteAdminImage(oldPhotoUrl);
      }
      const newPhotoUrl = await this.storeAdminImage(dto.photoFile);
      adminProfileUpdate.photoUrl = newPhotoUrl;
    }

    const usersUpdate: Prisma.UsersUpdateInput = {};
    if (dto.state !== undefined) usersUpdate.state = dto.state;
    if (dto.role !== undefined) usersUpdate.role = dto.role;

    const hasUserData = target.UserData !== null;
    const hasUserDataUpdate = Object.keys(userDataUpdate).length > 0;
    const hasAdminProfileUpdate = Object.keys(adminProfileUpdate).length > 0;

    if (hasUserData && hasUserDataUpdate && !hasAdminProfileUpdate) {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          ...usersUpdate,
          UserData: { update: userDataUpdate },
        },
        include: { UserData: true, AdminProfile: true },
      });
    }

    if (!hasUserData && hasUserDataUpdate && hasAdminProfileUpdate) {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          ...usersUpdate,
          UserData: { create: userDataCreate },
          AdminProfile: { update: adminProfileUpdate },
        },
        include: { UserData: true, AdminProfile: true },
      });
    }

    if (!hasUserData && hasUserDataUpdate && !hasAdminProfileUpdate) {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          ...usersUpdate,
          UserData: { create: userDataCreate },
        },
        include: { UserData: true, AdminProfile: true },
      });
    }

    if (hasUserData && hasUserDataUpdate && hasAdminProfileUpdate) {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          ...usersUpdate,
          UserData: { update: userDataUpdate },
          AdminProfile: { update: adminProfileUpdate },
        },
        include: { UserData: true, AdminProfile: true },
      });
    }

    if (!hasUserData && !hasUserDataUpdate && hasAdminProfileUpdate) {
      return this.prisma.users.update({
        where: { id: userId },
        data: {
          ...usersUpdate,
          AdminProfile: { update: adminProfileUpdate },
        },
        include: { UserData: true, AdminProfile: true },
      });
    }

    // Solo usersUpdate (role o state) - sin cambios en UserData ni AdminProfile
    return this.prisma.users.update({
      where: { id: userId },
      data: usersUpdate,
      include: { UserData: true, AdminProfile: true },
    });
  }

  async createCompanyAdmin(
    empresaId: number,
    dto: CreateAdminUserDto,
    user?: AuthenticatedUser,
    photoFile?: Express.Multer.File,
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });

    if (!empresa) {
      throw new NotFoundException(`La empresa con ID ${empresaId} no existe.`);
    }

    return this.createAdmin({ dto, role: Role.COMPANY_ADMIN, empresaId });
  }

  async createBranchAdmin(
    sedeId: number,
    dto: CreateAdminUserDto,
    user: AuthenticatedUser,
    photoFile?: Express.Multer.File,
  ) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true, empresaId: true },
    });

    if (!sede) {
      throw new NotFoundException(`La sede con ID ${sedeId} no existe.`);
    }

    if (dto.empresaId && dto.empresaId !== sede.empresaId) {
      throw new BadRequestException(
        'La sede seleccionada no pertenece a la empresa indicada.',
      );
    }

    // Validar alcance para COMPANY_ADMIN
    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || user.empresaId !== sede.empresaId) {
        throw new ForbiddenException(
          'No puede crear administradores para sedes fuera de su empresa.',
        );
      }
    }

    return this.createAdmin({
      dto,
      role: Role.BRANCH_ADMIN,
      empresaId: sede.empresaId,
      sedeId: sede.id,
    });
  }

  async createBranchEmployee(
    sedeId: number,
    dto: CreateAdminUserDto,
    user: AuthenticatedUser,
    photoFile?: Express.Multer.File,
  ) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true, empresaId: true },
    });

    if (!sede) {
      throw new NotFoundException(`La sede con ID ${sedeId} no existe.`);
    }

    if (dto.empresaId && dto.empresaId !== sede.empresaId) {
      throw new BadRequestException(
        'La sede seleccionada no pertenece a la empresa indicada.',
      );
    }

    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || user.empresaId !== sede.empresaId) {
        throw new ForbiddenException(
          'No puede crear empleados para sedes fuera de su empresa.',
        );
      }
    }

    if (user.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId || user.sedeId !== sede.id) {
        throw new ForbiddenException(
          'No puede crear empleados para otra sede.',
        );
      }
    }

    return this.createAdmin({
      dto,
      role: Role.EMPLOYEE,
      empresaId: sede.empresaId,
      sedeId: sede.id,
    });
  }

  private async createAdmin({
    dto,
    role,
    empresaId,
    sedeId,
  }: AdminCreationParams) {
    if (dto.role && dto.role !== role) {
      throw new BadRequestException(`El rol proporcionado debe ser ${role}.`);
    }

    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException(
        'Debe proporcionar nombre y apellido para el administrador.',
      );
    }

    const fullName = (dto.name ?? `${dto.firstName} ${dto.lastName}`).trim();
    if (!fullName) {
      throw new BadRequestException(
        'Debe proporcionar un nombre completo válido para el administrador.',
      );
    }

    const hashedPassword = await this.hashService.hash(dto.password);
    const idioma = dto.idioma ?? 'es';
    const gender = dto.gender ?? 'no especificado';
    const clientType = dto.clientType ?? ClientType.business;
    const state = dto.state ?? ClientState.enabled;

    try {
      const user = await this.prisma.users.create({
        data: {
          email: dto.email,
          clientType,
          state,
          acceptTerms: true,
          acceptPolitics: true,
          fotoPerfil: null,
          role,
          UserAuth: {
            create: {
              email: dto.email,
              password: hashedPassword,
            },
          },
          UserData: {
            create: {
              name: fullName,
              phone: dto.phone,
              email: dto.email,
              countryId: dto.countryId,
              idioma,
              gender,
              birthdate: dto.birthdate ? new Date(dto.birthdate) : null,
            },
          },
          AdminProfile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              photoUrl: null, // TODO: Implementar upload de archivo y guardar URL
              empresaId,
              sedeId: sedeId ?? undefined,
            },
          },
        },
        include: {
          AdminProfile: true,
          UserData: true,
        },
      });

      return {
        message: 'Administrador creado correctamente.',
        user,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = this.extractUniqueTarget(error);
        throw new ConflictException(
          `Ya existe un registro con el mismo valor para: ${target}.`,
        );
      }

      throw error;
    }
  }

  private extractUniqueTarget(error: Prisma.PrismaClientKnownRequestError) {
    const target = Array.isArray(error.meta?.target)
      ? (error.meta?.target as string[])
      : [error.meta?.target as string];

    return target.filter(Boolean).join(', ') || 'campo único';
  }

  private ensureAdminScopeAccess(
    adminProfile: { empresaId: number | null; sedeId: number | null },
    user: AuthenticatedUser,
  ) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }

    if (user.role === Role.COMPANY_ADMIN) {
      if (!user.empresaId || !adminProfile.empresaId) {
        throw new ForbiddenException('No se encontró la empresa asociada.');
      }

      if (user.empresaId !== adminProfile.empresaId) {
        throw new ForbiddenException(
          'No puede gestionar administradores fuera de su empresa.',
        );
      }
      return;
    }

    if (user.role === Role.BRANCH_ADMIN) {
      if (!user.sedeId || !adminProfile.sedeId) {
        throw new ForbiddenException('No se encontró la sede asociada.');
      }

      if (user.sedeId !== adminProfile.sedeId) {
        throw new ForbiddenException(
          'No puede gestionar administradores fuera de su sede.',
        );
      }
      return;
    }

    throw new ForbiddenException(
      'No tiene permisos para acceder a este recurso.',
    );
  }

  async deleteAdmin(userId: number, user: AuthenticatedUser) {
    const admin = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { AdminProfile: true },
    });

    if (!admin) {
      throw new NotFoundException(
        `Administrador con ID ${userId} no encontrado.`,
      );
    }

    if (!admin.AdminProfile) {
      throw new BadRequestException(
        `El usuario con ID ${userId} no es un administrador.`,
      );
    }

    if (
      admin.role !== Role.COMPANY_ADMIN &&
      admin.role !== Role.BRANCH_ADMIN &&
      admin.role !== Role.EMPLOYEE
    ) {
      throw new BadRequestException(
        `El usuario con ID ${userId} no es un administrador o empleado válido.`,
      );
    }

    this.ensureAdminScopeAccess(
      {
        empresaId: admin.AdminProfile.empresaId,
        sedeId: admin.AdminProfile.sedeId,
      },
      user,
    );

    await this.prisma.$transaction([
      this.prisma.adminProfile.delete({
        where: { userId },
      }),
      this.prisma.userAuth.delete({
        where: { user_id: userId },
      }),
      this.prisma.userData.delete({
        where: { userId },
      }),
      this.prisma.users.delete({
        where: { id: userId },
      }),
    ]);

    return { message: 'Administrador eliminado exitosamente.' };
  }

  /**
   * Activa un usuario (CLIENT, COMPANY_ADMIN, BRANCH_ADMIN) que esté en estado disabled o blocked.
   * Solo accesible por SUPER_ADMIN.
   */
  async activateUser(userId: number, user: AuthenticatedUser) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Solo un super administrador puede activar usuarios directamente.',
      );
    }

    const targetUser = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    if (targetUser.state === 'enabled') {
      return { message: 'El usuario ya se encuentra activo.' };
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: { state: 'enabled' },
    });

    return {
      message: `Usuario ${targetUser.email} activado exitosamente.`,
      userId: targetUser.id,
      state: 'enabled',
    };
  }
}
