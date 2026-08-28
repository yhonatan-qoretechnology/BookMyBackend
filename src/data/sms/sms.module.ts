import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule, ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }])],
  providers: [SmsService],
  controllers: [SmsController],
})
export class SmsModule {}
