import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ValidatePhoneDto } from './dto/validate-phone.dto';
import { HashService } from './services/hash/hash.service';

@Injectable()
export class AuthService {
  EXPIRATION_TOKEN_TIME = '15m';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private hashService: HashService,
  ) {}

  async checkUser(userId: number) {
    if (!userId) throw new NotFoundException('User ID is required');
    const user = await this.prisma.userAuth.findFirst({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
  }

  async register(dto: RegisterDto) {
    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // 1. Validar que el país exista
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });
      if (!country) {
        throw new BadRequestException(
          'El ID del país proporcionado no es válido.',
        );
      }

      // 2. Crear el usuario solo si las validaciones pasan
      const user = await this.prisma.users.create({
        data: {
          email: dto.email,
          clientType: dto.clientType,
          acceptTerms: dto.acceptTerms,
          acceptPolitics: dto.acceptPolitics,
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
        include: {
          UserData: true,
        },
      });

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

      return user;
    } catch (error) {
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
            clientType: true,
            state: true,
            acceptTerms: true,
            acceptPolitics: true,
            createdAt: true,
            updatedAt: true,
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
          },
        },
      },
    });

    // Validaciones
    if (!userAuth || !userAuth.password) {
      return { error: 'Credenciales incorrectas.' };
    }

    const isPasswordValid = await this.hashService.compare(
      password,
      userAuth.password,
    );

    if (!isPasswordValid) {
      return { error: 'Credenciales incorrectas.' };
    }

    if (userAuth.user.state !== 'enabled') {
      return { error: 'El usuario no está activo.' };
    }

    // Remover password de la respuesta
    const { password: _, ...userData } = userAuth;

    // Generar token con los datos del usuario
    const token = await this.generateToken({
      id: userAuth.user.id,
      email, // correo del usuario
      name: userAuth.user.UserData?.name,
      gender: userAuth.user.UserData?.gender,
      birthdate: userAuth.user.UserData?.birthdate,
      phone: userAuth.user.UserData?.phone,
      idioma: userAuth.user.UserData?.idioma,
      country: userAuth.user.UserData?.country,
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
    };

    const token = this.jwtService.sign(payload, { expiresIn: '1d' });
    return token;
  }

  async recoveryPass(token: string, password: string) {
    const data = this.jwtService.decode(token);
    console.log('Decoded data:', data);
    const userId = data.id;
    this.checkUser(userId);
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

    // Validar formato con libphonenumber-js
    const parsed = parsePhoneNumberFromString(phone);

    if (!parsed) {
      throw new BadRequestException('Formato de número inválido');
    }

    if (parsed.country !== 'ES') {
      throw new BadRequestException('El número no es de España');
    }

    // Simulación de búsqueda en base de datos
    const exists = this.mockDBPhones.includes(phone);

    if (exists) {
      throw new BadRequestException('El número ya está registrado');
    }

    return {
      success: true,
      message: 'Número válido y disponible',
      formatted: parsed.formatInternational(),
    };
  }
}
