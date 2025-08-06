import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule],
  providers: [SmsService],
  controllers: [SmsController],
})
export class SmsModule {}
