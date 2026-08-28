import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../email/mail.module';
import { SmsService } from '../sms/sms.service';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  /* Cada OTP dispara un SMS de Twilio o un correo: sin límite, pedirlo en
     bucle es una factura abierta y una vía de spam con tu remitente. */
  imports: [
    MailModule,
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
  ],
  controllers: [OtpController],
  providers: [OtpService, SmsService],
  exports: [OtpService],
})
export class OtpModule {}
