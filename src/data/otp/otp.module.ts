import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailModule } from '../email/mail.module';
import { SmsService } from '../sms/sms.service';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  imports: [MailModule],
  controllers: [OtpController],
  providers: [OtpService, SmsService, PrismaService],
  exports: [OtpService],
})
export class OtpModule {}
