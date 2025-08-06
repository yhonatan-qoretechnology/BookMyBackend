import { BadRequestException, Injectable } from '@nestjs/common';
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

    if (!record || new Date() > record.expiresAt) {
      throw new BadRequestException('Código inválido o expirado');
    }

    await this.prisma.otp.update({
      where: { id: record.id },
      data: { verified: true },
    });

    return { message: 'Código verificado correctamente' };
  }
}
