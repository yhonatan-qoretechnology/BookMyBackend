import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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

      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('El email ya está en uso');
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.userAuth.findUnique({
      where: { email },
      include: { user: true },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const isPasswordValid = await this.hashService.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (user.user.state !== 'enabled') {
      throw new UnauthorizedException(
        'El usuario no está activo, se envió un código de validación a su correo.',
      );
    }
    const { password: _, ...userData } = user;

    const token = await this.generateToken(userData);

    return { user: userData, token };
  }

  async generateToken(user: any): Promise<string> {
    const payload = { email: user.email, id: user.id };
    const token = this.jwtService.sign(payload, {
      expiresIn: this.EXPIRATION_TOKEN_TIME,
    });
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
