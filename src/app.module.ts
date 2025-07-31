import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { DataModule } from './data/data.module';
import { SmsModule } from './data/otp/sms.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        JWT_SECRET_KEY: Joi.string().required(),
      }),
    }),
    AuthModule,
    PrismaModule,
    SwaggerModule,
    SeedModule,
    DataModule,
    SmsModule,
  ],
})
export class AppModule {}
