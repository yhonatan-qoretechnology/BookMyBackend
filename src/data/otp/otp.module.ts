import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  controllers: [OtpController],
  providers: [OtpService, SmsService, PrismaService],
})
export class OtpModule {}
