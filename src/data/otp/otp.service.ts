import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = dayjs().add(5, 'minutes').toDate();

    await this.prisma.otp.create({
      data: {
        phone: dto.phone,
        code,
        expiresAt,
      },
    });

    await this.smsService.sendSms(dto.phone, `Tu código OTP es ${code}`);

    return { message: 'Código enviado por SMS' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // 1. Permite que la variable sea null.
    //    Quita la anotación de tipo explícita para que TypeScript infiera el tipo correcto.
    const record = await this.prisma.otp.findFirst({
      where: {
        phone: dto.phone,
        code: dto.code,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Maneja el caso en el que no se encuentre el registro.
    if (!record || new Date() > record.expiresAt) {
      throw new BadRequestException('Código inválido o expirado');
    }

    // 3. Si el registro existe y es válido, actualiza el estado del OTP y del usuario.
    await this.prisma.otp.update({
      where: { id: record.id },
      data: { verified: true },
    });

    const userData = await this.prisma.userData.findUnique({
      where: { phone: dto.phone },
      include: { user: true },
    });

    if (!userData) {
      throw new NotFoundException(
        'Usuario no encontrado para este número de teléfono.',
      );
    }

    await this.prisma.users.update({
      where: { id: userData.userId },
      data: { state: 'enabled' },
    });

    return { message: 'Código verificado correctamente y usuario activado' };
  }
}
