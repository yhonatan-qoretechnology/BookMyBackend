import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../email/mail.module';
import { SmsService } from '../sms/sms.service';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  imports: [MailModule, PrismaModule],
  controllers: [OtpController],
  providers: [OtpService, SmsService],
  exports: [OtpService],
})
export class OtpModule {}
