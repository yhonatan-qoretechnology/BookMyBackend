import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../email/mail.service';
import { SmsService } from '../sms/sms.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class OtpService {
  [x: string]: any;
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
    private mailService: MailService,
  ) {}

  /* Fallos seguidos por email. En memoria: con una instancia basta, y un
     reinicio solo devuelve unos pocos intentos. */
  private readonly fallos = new Map<string, number>();
  private static readonly MAX_FALLOS = 5;

  /**
   * Un código nuevo invalida los anteriores. Antes valía CUALQUIER OTP sin
   * usar del email, así que pedir muchos multiplicaba las probabilidades de
   * acertar uno por fuerza bruta.
   */
  private async emitirCodigo(email: string) {
    await this.prisma.otp.updateMany({
      where: { email, verified: false },
      data: { verified: true },
    });
    this.fallos.delete(email);

    // Math.random no es criptográfico: el código se podía predecir.
    const code = randomInt(100000, 1000000).toString();
    await this.prisma.otp.create({
      data: {
        email,
        code,
        expiresAt: dayjs().add(5, 'minutes').toDate(),
      },
    });
    return code;
  }

  /**
   * El OTP vigente del email si `code` coincide. Tras MAX_FALLOS intentos
   * fallidos se invalida y hay que pedir otro.
   */
  async validarCodigo(email: string, code: string) {
    const record = await this.prisma.otp.findFirst({
      where: { email, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || new Date() > record.expiresAt) {
      throw new BadRequestException('Código inválido o expirado');
    }

    if (record.code !== code) {
      const fallos = (this.fallos.get(email) ?? 0) + 1;
      if (fallos >= OtpService.MAX_FALLOS) {
        this.fallos.delete(email);
        await this.prisma.otp.updateMany({
          where: { email, verified: false },
          data: { verified: true },
        });
        throw new BadRequestException(
          'Demasiados intentos. Pide un código nuevo.',
        );
      }
      this.fallos.set(email, fallos);
      throw new BadRequestException('Código inválido o expirado');
    }

    this.fallos.delete(email);
    return record;
  }

  async sendOtp(dto: SendOtpDto) {
    const code = await this.emitirCodigo(dto.email);

    //await this.smsService.sendSms(dto.phone, `Tu código OTP es ${code}`);

    await this.mailService.sendUserConfirmation(dto.email, code);

    return { message: 'Código enviado al correo' };
  }

  async sendPasswordResetOtp(dto: SendOtpDto) {
    const code = await this.emitirCodigo(dto.email);

    await this.mailService.sendPasswordResetOtp(dto.email, code);

    return { message: 'Código enviado al correo' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // 1. Permite que la variable sea null.
    //    Quita la anotación de tipo explícita para que TypeScript infiera el tipo correcto.
    const record = await this.validarCodigo(dto.email, dto.code);

    // 3. Si el registro existe y es válido, actualiza el estado del OTP y del usuario.
    await this.prisma.otp.update({
      where: { id: record.id },
      data: { verified: true },
    });

    const userData = await this.prisma.userData.findUnique({
      where: { email: dto.email },
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
