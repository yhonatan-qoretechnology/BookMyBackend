import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AppointmentModule } from './data/appointment/appointment.module';
import { CategoryModule } from './data/category/category.module';
import { DataModule } from './data/data.module';
import { DiaCerradoSedeModule } from './data/diaCerradoSede/dia-cerrado-sede.module';
import { DisponibilidadProfesionalModule } from './data/disponibilidadProfesional/disponibilidad-profesional.module';
import { MailModule } from './data/email/mail.module';
import { EmpresaModule } from './data/empresa/empresa.module';
import { HorarioSedeModule } from './data/HorarioSede/horario-sede.module';
import { OtpModule } from './data/otp/otp.module';
import { PaymentModule } from './data/payment/payment.module';
import { ProfesionalModule } from './data/profecional/profesional.module';
import { ResenaModule } from './data/resena/resena.module';
import { SedeModule } from './data/sede/sede.module';
import { ServiceSedeProfesionalModule } from './data/service-sede-profesional/service-sede-profesional.module';
import { ServiceModule } from './data/serviceCategory/service.module';
import { SmsModule } from './data/sms/sms.module';
import { UserLocationModule } from './data/user-location/user-location.module';
import { UserCategoriesModule } from './data/userCategory/user-categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeedModule } from './seed/seed.module';
import { StorageModule } from './storage/storage.module';
import { ChatMessageModule } from './data/chatMessage/chatMessage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        JWT_SECRET_KEY: Joi.string().required(),
        SFTP_HOST: Joi.string().optional(),
        SFTP_PORT: Joi.number().optional(),
        SFTP_USER: Joi.string().optional(),
        SFTP_PASSWORD: Joi.string().optional(),
        SFTP_REMOTE_ROOT_PATH: Joi.string().optional(),
        UPLOADS_PUBLIC_BASE_URL: Joi.string().optional(),
      }),
    }),
    StorageModule,
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
    SedeModule,
    ProfesionalModule,
    ResenaModule,
    ServiceSedeProfesionalModule,
    AppointmentModule,

    DiaCerradoSedeModule,
    DisponibilidadProfesionalModule,
    HorarioSedeModule,
    PaymentModule,
    ChatModule,
    ChatMessageModule,
  ],
})
export class AppModule {}
