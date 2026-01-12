import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientState, ClientType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAdminUserDto } from '../../dto/create-admin-user.dto';
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
  ) {}

  async createCompanyAdmin(empresaId: number, dto: CreateAdminUserDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });

    if (!empresa) {
      throw new NotFoundException(`La empresa con ID ${empresaId} no existe.`);
    }

    return this.createAdmin({ dto, role: Role.COMPANY_ADMIN, empresaId });
  }

  async createBranchAdmin(sedeId: number, dto: CreateAdminUserDto) {
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

    return this.createAdmin({
      dto,
      role: Role.BRANCH_ADMIN,
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
}
