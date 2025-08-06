import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

  async register(registerDto: RegisterDto) {
    const {
      name,
      phone,
      email,
      genero,
      idioma,
      password,
      countryId,
      acceptPolitics,
      acceptTerms,
      clientType,
    } = registerDto;

    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });
    const existingUserData = await this.prisma.userData.findUnique({
      where: { email },
    });
    if (existingUser || existingUserData) {
      throw new BadRequestException(
        'El correo electrónico ya está registrado.',
      );
    }

    const hashedPassword = await this.hashService.hash(password);

    // 1. Crear usuario base (users)
    const createdUser = await this.prisma.users.create({
      data: {
        email,
        clientType,
        acceptPolitics,
        acceptTerms,
      },
    });

    // 2. Crear auth asociado al usuario
    await this.prisma.userAuth.create({
      data: {
        email,
        password: hashedPassword,
        user_id: createdUser.id,
      },
    });

    // 3. Crear data adicional del usuario
    await this.prisma.userData.create({
      data: {
        name,
        phone,
        email,
        genero,
        idioma,
        countryId,
        userId: createdUser.id,
      },
    });

    const token = await this.generateToken({ id: createdUser.id, email });

    return {
      message: 'Usuario registrado correctamente',
      token,
      user: {
        id: createdUser.id,
        name,
        phone,
        email,
        genero,
        idioma,
        countryId,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.userAuth.findUnique({
      where: { email },
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

  private mockDBPhones = ['+34611222333', '+34699888777']; // simula base de datos

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
