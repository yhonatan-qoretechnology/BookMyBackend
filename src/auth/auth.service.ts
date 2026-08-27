import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserAuth } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { OtpService } from '../data/otp/otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { SftpStorageService } from '../storage/sftp-storage.service';
import { BootstrapSuperAdminDto } from './dto/bootstrap-super-admin.dto';
import { ChangePasswordByAdminDto } from './dto/change-password-by-admin.dto';
import { ChangePasswordOtpDto } from './dto/change-password-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordOtpDto } from './dto/request-password-otp.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidatePasswordOtpDto } from './dto/validate-password-otp.dto';
import { ValidatePhoneDto } from './dto/validate-phone.dto';
import { HashService } from './services/hash/hash.service';
import { AuthenticatedUser } from './types/authenticated-user.interface';

type UserAuthContext = {
  userId: number;
  userAuth: UserAuth;
};

@Injectable()
export class AuthService {
  EXPIRATION_TOKEN_TIME = process.env.JWT_EXPIRATION ?? '12h';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private hashService: HashService,
    private otpService: OtpService,
    private readonly sftpStorage: SftpStorageService,
  ) {}

  private async storeUserImage(file: Express.Multer.File) {
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
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }
    const finalPath = path.join(userUploadsDir, finalFileName);
    fs.renameSync(file.path, finalPath);
    return finalPath.replace(/\\/g, '/');
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
        console.error(
          `Error al eliminar archivo remoto de usuario: ${filePath}`,
          error,
        );
      }
    }
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(filePath);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (error) {
        console.error(
          `Error al eliminar archivo de usuario: ${absPath}`,
          error,
        );
      }
    }
  }

  async bootstrapSuperAdmin(dto: BootstrapSuperAdminDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Este endpoint no está disponible en producción.',
      );
    }

    const existingSuperAdmin = await this.prisma.users.findFirst({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true },
    });

    if (existingSuperAdmin) {
      throw new BadRequestException(
        'Ya existe al menos un usuario SUPER_ADMIN.',
      );
    }

    const phone = dto.phone?.replace(/\s+/g, '') ?? '';
    if (phone.length < 7) {
      throw new BadRequestException(
        'El número de teléfono debe tener al menos 7 dígitos.',
      );
    }

    const hashedPassword = await this.hashService.hash(dto.password);

    const user = await this.prisma.users.create({
      data: {
        email: dto.email,
        clientType: dto.clientType,
        state: dto.state,
        acceptTerms: true,
        acceptPolitics: true,
        fotoPerfil: null,
        role: Role.SUPER_ADMIN,
        UserAuth: {
          create: {
            email: dto.email,
            password: hashedPassword,
          },
        },
        UserData: {
          create: {
            name: dto.name,
            phone: phone,
            email: dto.email,
            gender: dto.gender,
            idioma: dto.idioma,
            countryId: dto.countryId,
            birthdate: dto.birthdate ? new Date(dto.birthdate) : null,
          },
        },
      },
      include: {
        UserData: true,
      },
    });

    return {
      message: 'SUPER_ADMIN creado correctamente (solo entorno no productivo).',
      user,
    };
  }

  private async getUserAuthContextByIdOrThrow(
    userId: number,
  ): Promise<UserAuthContext> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { UserAuth: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    if (!user.UserAuth) {
      throw new BadRequestException(
        'El usuario no tiene credenciales asociadas para actualizar la contraseña.',
      );
    }

    return {
      userId: user.id,
      userAuth: user.UserAuth,
    };
  }

  private async getUserAuthContextByEmailOrThrow(
    email: string,
  ): Promise<UserAuthContext> {
    const user = await this.prisma.users.findUnique({
      where: { email },
      include: { UserAuth: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con correo ${email} no encontrado.`);
    }

    if (!user.UserAuth) {
      throw new BadRequestException(
        'El usuario no tiene credenciales asociadas para actualizar la contraseña.',
      );
    }

    return {
      userId: user.id,
      userAuth: user.UserAuth,
    };
  }

  private async ensureCurrentPasswordMatches(
    currentPassword: string,
    hashedPassword: string,
  ) {
    const currentPasswordMatches = await this.hashService.compare(
      currentPassword,
      hashedPassword,
    );

    if (!currentPasswordMatches) {
      // Se acompaña de un `code` estable: los clientes distinguían estos casos
      // buscando trozos del mensaje en español, así que cualquier cambio de
      // redacción o de idioma les rompía el flujo.
      throw new BadRequestException({
        message: 'La contraseña actual es incorrecta.',
        code: 'CURRENT_PASSWORD_INVALID',
      });
    }
  }

  private async ensureNewPasswordIsDifferent(
    newPassword: string,
    hashedPassword: string,
  ) {
    const isSamePassword = await this.hashService.compare(
      newPassword,
      hashedPassword,
    );

    if (isSamePassword) {
      throw new BadRequestException({
        message: 'La nueva contraseña debe ser diferente a la actual.',
        code: 'NEW_PASSWORD_SAME_AS_CURRENT',
      });
    }
  }

  private async ensureOtpIsValid(email: string, code: string) {
    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email,
        code,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('Código OTP inválido o expirado.');
    }

    return otpRecord;
  }

  private async updatePasswordHash(userId: number, newPassword: string) {
    const hashedPassword = await this.hashService.hash(newPassword);

    await this.prisma.userAuth.update({
      where: { user_id: userId },
      data: {
        password: hashedPassword,
      },
    });
  }

  async requestPasswordOtp(dto: RequestPasswordOtpDto) {
    const userExists = await this.prisma.users.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundException(
        `Usuario con correo ${dto.email} no encontrado.`,
      );
    }

    await this.otpService.sendPasswordResetOtp({ email: dto.email });

    return { message: 'Se envió un código OTP al correo registrado.' };
  }

  async checkUser(userId: number) {
    if (!userId) throw new NotFoundException('User ID is required');
    const user = await this.prisma.userAuth.findFirst({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
  }

  async register(
    dto: RegisterDto,
    file?: Express.Multer.File,
    currentUser?: AuthenticatedUser,
  ) {
    let createdUserId: number | null = null;
    let fotoPerfilPath: string | null = null;
    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const role = dto.role ?? Role.CLIENT;

      if (role !== Role.CLIENT) {
        if (!currentUser || currentUser.role !== Role.SUPER_ADMIN) {
          throw new ForbiddenException(
            'Solo un SUPER_ADMIN puede crear administradores. Usa los endpoints de /admin.',
          );
        }

        if (!dto.firstName || !dto.lastName) {
          throw new BadRequestException(
            'Debe proporcionar nombre y apellido para crear un administrador.',
          );
        }
      }

      // 1. Validar que el país exista
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });
      if (!country) {
        throw new BadRequestException(
          'El ID del país proporcionado no es válido.',
        );
      }

      let empresaIdForAdmin: number | null = null;
      let sedeIdForAdmin: number | null = null;

      if (role === Role.COMPANY_ADMIN) {
        if (!dto.empresaId) {
          throw new BadRequestException(
            'Debe proporcionar la empresa asociada para un administrador de empresa.',
          );
        }

        const empresaExists = await this.prisma.empresa.findUnique({
          where: { id: dto.empresaId },
        });

        if (!empresaExists) {
          throw new BadRequestException('La empresa asociada no existe.');
        }

        empresaIdForAdmin = dto.empresaId;
      }

      if (role === Role.BRANCH_ADMIN) {
        if (!dto.sedeId) {
          throw new BadRequestException(
            'Debe proporcionar la sede asociada para un administrador de sede.',
          );
        }

        const sede = await this.prisma.sede.findUnique({
          where: { id: dto.sedeId },
          select: { id: true, empresaId: true },
        });

        if (!sede) {
          throw new BadRequestException('La sede asociada no existe.');
        }

        sedeIdForAdmin = sede.id;
        empresaIdForAdmin = dto.empresaId ?? sede.empresaId;

        if (dto.empresaId && dto.empresaId !== sede.empresaId) {
          throw new BadRequestException(
            'La sede seleccionada no pertenece a la empresa indicada.',
          );
        }
      }

      // 2. Crear el usuario solo si las validaciones pasan
      if (file) {
        fotoPerfilPath = await this.storeUserImage(file);
      }

      const user = await this.prisma.users.create({
        data: {
          email: dto.email,
          clientType: dto.clientType,
          state: dto.state,
          acceptTerms: dto.acceptTerms,
          acceptPolitics: dto.acceptPolitics,
          fotoPerfil: fotoPerfilPath,
          role,
          UserAuth: {
            create: {
              email: dto.email,
              password: hashedPassword,
            },
          },
          UserData: {
            create: {
              name: dto.name,
              phone: dto.phone,
              email: dto.email,
              gender: dto.gender,
              idioma: dto.idioma,
              countryId: dto.countryId,
              birthdate: dto.birthdate ? new Date(dto.birthdate) : null,
            },
          },
        },
      });
      createdUserId = user.id;

      if (role !== Role.CLIENT) {
        await this.prisma.adminProfile.create({
          data: {
            userId: user.id,
            firstName: dto.firstName ?? dto.name,
            lastName: dto.lastName ?? '',
            phone: dto.phone,
            photoUrl: fotoPerfilPath ?? undefined,
            empresaId: empresaIdForAdmin ?? undefined,
            sedeId: sedeIdForAdmin ?? undefined,
          },
        });
      }

      // 3. Asociar categorías al usuario (si se enviaron en el registro)
      if (dto.categoryIds && dto.categoryIds.length > 0) {
        const uniqueCategoryIds = [...new Set(dto.categoryIds)];

        // Validar que todas las categorías existen
        const foundCategories = await this.prisma.category.findMany({
          where: { id: { in: uniqueCategoryIds } },
          select: { id: true },
        });

        if (foundCategories.length !== uniqueCategoryIds.length) {
          const existingIds = new Set(foundCategories.map((c) => c.id));
          const missingIds = uniqueCategoryIds.filter(
            (id) => !existingIds.has(id),
          );
          throw new BadRequestException(
            `Las siguientes categorías no se encontraron: ${missingIds.join(', ')}.`,
          );
        }

        // Crear relaciones en userCategory
        const userCategoryData = uniqueCategoryIds.map((categoryId) => ({
          userId: user.id,
          categoryId,
        }));

        await this.prisma.userCategory.createMany({
          data: userCategoryData,
          skipDuplicates: true,
        });
      }

      return this.prisma.users.findUnique({
        where: { id: user.id },
        include: {
          UserData: true,
          AdminProfile: true,
        },
      });
    } catch (error) {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      if (fotoPerfilPath) {
        await this.safeDeleteRemoteOrLocal(fotoPerfilPath);
      }

      if (createdUserId) {
        try {
          await this.prisma.users.delete({ where: { id: createdUserId } });
        } catch (cleanupError) {
          // noop: si no se puede limpiar, continuamos con el error original
        }
      }
      if (error.code === 'P2002') {
        const target = Array.isArray((error as any).meta?.target)
          ? ((error as any).meta.target as string[]).join(',')
          : (((error as any).meta?.target as string | undefined) ?? '');

        // Mensajes específicos según el índice/columna única que falle
        if (target.includes('Users_email_key') || target.includes('email')) {
          // Buscar usuario por email y revisar estado
          const existingUser = await this.prisma.users.findFirst({
            where: { email: dto.email },
            select: { state: true },
          });

          if (existingUser && existingUser.state !== 'enabled') {
            throw new BadRequestException(
              'El usuario ya está registrado pero no está activo.',
            );
          }

          throw new BadRequestException('El email ya está registrado');
        }

        if (target.includes('UserData_phone_key') || target.includes('phone')) {
          // Buscar usuario por teléfono y revisar estado
          const existingUserData = await this.prisma.userData.findFirst({
            where: { phone: dto.phone },
            select: {
              user: {
                select: { state: true },
              },
            },
          });

          if (
            existingUserData?.user &&
            existingUserData.user.state !== 'enabled'
          ) {
            throw new BadRequestException(
              'El usuario ya está registrado pero no está activo.',
            );
          }

          throw new BadRequestException('El teléfono ya está registrado');
        }

        // Fallback genérico para otros campos únicos
        throw new BadRequestException(
          'Ya existe un registro con los datos proporcionados.',
        );
      }
      throw error;
    }
  }

  async updateUserProfile(userId: number, dto: UpdateUserDto) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { UserData: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    const {
      categoryIds,
      name,
      phone,
      direccion,
      idioma,
      gender,
      birthdate,
      countryId,
      ...userFields
    } = dto;

    if (Object.keys(userFields).length > 0) {
      await this.prisma.users.update({
        where: { id: userId },
        data: userFields,
      });
    }

    if (
      name !== undefined ||
      phone !== undefined ||
      direccion !== undefined ||
      idioma !== undefined ||
      gender !== undefined ||
      birthdate !== undefined ||
      countryId !== undefined
    ) {
      await this.prisma.userData.update({
        where: { userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(direccion !== undefined ? { direccion } : {}),
          ...(idioma !== undefined ? { idioma } : {}),
          ...(gender !== undefined ? { gender } : {}),
          ...(birthdate !== undefined
            ? { birthdate: birthdate ? new Date(birthdate) : null }
            : {}),
          ...(countryId !== undefined ? { countryId } : {}),
        },
      });
    }

    if (categoryIds && categoryIds.length > 0) {
      await this.prisma.userCategory.deleteMany({ where: { userId } });
      const uniqueIds = [...new Set(categoryIds)];
      const data = uniqueIds.map((categoryId) => ({ userId, categoryId }));
      await this.prisma.userCategory.createMany({ data, skipDuplicates: true });
    }

    return this.prisma.users.findUnique({
      where: { id: userId },
      include: { UserData: true, UserCategories: true },
    });
  }

  async updateUserPhoto(userId: number, file: Express.Multer.File) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    if (user.fotoPerfil) {
      await this.safeDeleteRemoteOrLocal(user.fotoPerfil);
    }

    const newFotoPerfilPath = await this.storeUserImage(file);

    return this.prisma.users.update({
      where: { id: userId },
      data: { fotoPerfil: newFotoPerfilPath },
    });
  }

  async validatePasswordOtp(dto: ValidatePasswordOtpDto) {
    await this.ensureOtpIsValid(dto.email, dto.code);

    return { message: 'Código OTP validado correctamente.' };
  }

  async changePasswordWithOtp(dto: ChangePasswordOtpDto) {
    const otpRecord = await this.ensureOtpIsValid(dto.email, dto.code);

    const { userId: persistedUserId, userAuth } =
      await this.getUserAuthContextByEmailOrThrow(dto.email);

    await this.ensureNewPasswordIsDifferent(dto.newPassword, userAuth.password);

    await this.updatePasswordHash(persistedUserId, dto.newPassword);

    await this.prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  async changePasswordWithCurrent(userId: number, dto: ChangePasswordDto) {
    const { userId: persistedUserId, userAuth } =
      await this.getUserAuthContextByIdOrThrow(userId);

    await this.ensureCurrentPasswordMatches(
      dto.currentPassword,
      userAuth.password,
    );

    await this.ensureNewPasswordIsDifferent(dto.newPassword, userAuth.password);

    await this.updatePasswordHash(persistedUserId, dto.newPassword);

    return { message: 'Contraseña actualizada correctamente.' };
  }

  async changePasswordById(userId: number, dto: ChangePasswordByAdminDto) {
    const { userId: persistedUserId, userAuth } =
      await this.getUserAuthContextByIdOrThrow(userId);

    await this.ensureNewPasswordIsDifferent(dto.newPassword, userAuth.password);

    await this.updatePasswordHash(persistedUserId, dto.newPassword);

    return { message: 'Contraseña actualizada correctamente.' };
  }

  async findAllUsers(_user?: AuthenticatedUser) {
    return this.prisma.users.findMany({
      include: {
        UserData: true,
        UserCategories: {
          include: { category: true },
        },
        AdminProfile: true,
      },
    });
  }

  async findUserById(userId: number, _user?: AuthenticatedUser) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        UserData: true,
        UserCategories: {
          include: { category: true },
        },
        AdminProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Buscar solo lo necesario
    const userAuth = await this.prisma.userAuth.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        user: {
          select: {
            id: true,
            email: true,
            clientType: true,
            state: true,
            acceptTerms: true,
            acceptPolitics: true,
            createdAt: true,
            updatedAt: true,
            fotoPerfil: true,
            role: true,
            UserData: {
              select: {
                id: true,
                name: true,
                phone: true,
                idioma: true,
                gender: true,
                birthdate: true,
                country: {
                  select: {
                    id: true,
                    name: true,
                    isoCode: true,
                  },
                },
              },
            },
            AdminProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                photoUrl: true,
                empresaId: true,
                sedeId: true,
              },
            },
            profesionales: {
              select: {
                id: true,
                nombre: true,
                phone: true,
                imagen: true,
                sedeId: true,
                sede: {
                  select: { id: true, nombre: true, empresaId: true },
                },
              },
            },
          },
        },
      },
    });

    // Validaciones
    if (!userAuth || !userAuth.password) {
      console.log(
        `[LOGIN] UserAuth NOT FOUND or NO PASSWORD for email: ${email}`,
      );
      return { error: 'Credenciales incorrectas.' };
    }

    if (!userAuth.user) {
      console.log(
        `[LOGIN] UserAuth FOUND but RELATIONAL USER IS MISSING for email: ${email}, authId: ${userAuth.id}`,
      );
      return { error: 'Error de integridad de cuenta.' };
    }

    const isPasswordValid = await this.hashService.compare(
      password,
      userAuth.password,
    );

    if (!isPasswordValid) {
      console.log(`[LOGIN] Password INVALID for email: ${email}`);
      return { error: 'Credenciales incorrectas.' };
    }

    console.log(
      `[LOGIN] SUCCESS STEP 1: AuthEmail=${email}, UserID=${userAuth.user.id}, UserEmail=${userAuth.user.email}, State=${userAuth.user.state}`,
    );

    if (userAuth.user.state !== 'enabled') {
      console.log(
        `[LOGIN] BLOCK: User state is '${userAuth.user.state}' for email: ${email}`,
      );
      return { error: 'El usuario no está activo.' };
    }

    // Remover password de la respuesta
    const { password: _, ...userData } = userAuth;

    // Generar token con los datos del usuario
    const adminProfile = userAuth.user.AdminProfile;
    const profesional = userAuth.user.profesionales;

    const token = await this.generateToken({
      id: userAuth.user.id,
      email: userAuth.user.email,
      // Para EMPLOYEE (profesionales) usamos su nombre/teléfono del registro
      // de Profesional si no tienen UserData cargado.
      name: userAuth.user.UserData?.name ?? profesional?.nombre,
      gender: userAuth.user.UserData?.gender,
      birthdate: userAuth.user.UserData?.birthdate,
      phone: userAuth.user.UserData?.phone ?? profesional?.phone,
      idioma: userAuth.user.UserData?.idioma,
      country: userAuth.user.UserData?.country,
      role: userAuth.user.role,
      empresaId: adminProfile?.empresaId ?? profesional?.sede?.empresaId ?? null,
      sedeId: adminProfile?.sedeId ?? profesional?.sedeId ?? null,
      profesionalId: profesional?.id ?? null,
    });

    return {
      user: userAuth.user,
      token,
    };
  }

  async generateToken(user: any): Promise<string> {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      gender: user.gender,
      birthdate: user.birthdate,
      phone: user.phone,
      idioma: user.idioma,
      country: user.country,
      role: user.role,
      empresaId: user.empresaId ?? null,
      sedeId: user.sedeId ?? null,
      profesionalId: user.profesionalId ?? null,
    };

    const token = this.jwtService.sign(payload, { expiresIn: '1d' });
    return token;
  }

  async recoveryPass(token: string, password: string) {
    /* `decode()` NO comprueba la firma: bastaba con enviar un JWT inventado
       cuyo cuerpo dijera {"id": <cualquiera>} para cambiarle la contraseña a
       cualquier usuario, incluido el SUPER_ADMIN. `verifyAsync` valida firma y
       caducidad con la misma clave con la que se emitió en `generateToken`. */
    let data: { id?: number };
    try {
      data = await this.jwtService.verifyAsync<{ id?: number }>(token);
    } catch {
      throw new UnauthorizedException(
        'El enlace de recuperación no es válido o ha caducado.',
      );
    }

    const userId = data?.id;
    if (!userId) {
      throw new UnauthorizedException(
        'El enlace de recuperación no es válido o ha caducado.',
      );
    }

    /* Sin `await` la excepción de `checkUser` se perdía en una promesa
       rechazada y la actualización seguía adelante. */
    await this.checkUser(userId);
    const hashedPassword = await this.hashService.hash(password);
    await this.prisma.userAuth.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return { message: 'Contraseña actualizada con éxito.' };
  }

  async checkUserExistence(email: string, phone: string) {
    const userData = await this.prisma.userData.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    return !!userData;
  }

  private mockDBPhones = ['+348001112233', '+348001112233']; // simula base de datos

  async validatePhone(dto: ValidatePhoneDto) {
    const { phone } = dto;

    // Validar que tenga al menos 7 dígitos
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      throw new BadRequestException(
        'El número de teléfono debe tener al menos 7 dígitos',
      );
    }

    // Simulación de búsqueda en base de datos
    const exists = this.mockDBPhones.includes(phone);

    if (exists) {
      throw new BadRequestException('El número ya está registrado');
    }

    return {
      success: true,
      message: 'Número válido y disponible',
      formatted: phone,
    };
  }
}
