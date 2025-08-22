import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './data/category/category.module';
import { DataModule } from './data/data.module';
import { MailModule } from './data/email/mail.module';
import { EmpresaModule } from './data/empresa/empresa.module';
import { OtpModule } from './data/otp/otp.module';
import { ServiceModule } from './data/serviceCategory/service.module';
import { SmsModule } from './data/sms/sms.module';
import { UserLocationModule } from './data/user-location/user-location.module';
import { UserCategoriesModule } from './data/userCategory/user-categories.module';
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
    OtpModule,
    MailModule,
    CategoryModule,
    ServiceModule,
    UserCategoriesModule,
    UserLocationModule,
    EmpresaModule,
  ],
})
export class AppModule {}
