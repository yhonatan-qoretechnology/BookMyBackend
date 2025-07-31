import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SwaggerModule } from '@nestjs/swagger';
import { SeedModule } from './seed/seed.module';
import { DataModule } from './data/data.module';

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
  ],
})
export class AppModule {}
