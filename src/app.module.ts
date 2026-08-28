import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import * as Joi from 'joi';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ChatModule } from './chat/chat.module';
import { AppointmentModule } from './data/appointment/appointment.module';
import { CategoryModule } from './data/category/category.module';
import { DataModule } from './data/data.module';
import { DiaCerradoSedeModule } from './data/diaCerradoSede/dia-cerrado-sede.module';
import { DisponibilidadProfesionalModule } from './data/disponibilidadProfesional/disponibilidad-profesional.module';
import { MailModule } from './data/email/mail.module';
import { EmpresaModule } from './data/empresa/empresa.module';
import { GastoModule } from './data/gasto/gasto.module';
import { HorarioSedeModule } from './data/HorarioSede/horario-sede.module';
import { NotificationModule } from './data/notification/notification.module';
import { OtpModule } from './data/otp/otp.module';
import { PaymentModule } from './data/payment/payment.module';
import { ProfesionalModule } from './data/profecional/profesional.module';
import { ResenaModule } from './data/resena/resena.module';
import { SedeModule } from './data/sede/sede.module';
import { ServiceSedeProfesionalModule } from './data/service-sede-profesional/service-sede-profesional.module';
import { SearchModule } from './data/search/search.module';
import { ServiceModule } from './data/serviceCategory/service.module';
import { SmsModule } from './data/sms/sms.module';
import { UserLocationModule } from './data/user-location/user-location.module';
import { UserCategoriesModule } from './data/userCategory/user-categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeedModule } from './seed/seed.module';

/* El SeedModule expone POST /seed/super-admin, que crea un SUPER_ADMIN y
   devuelve sus credenciales en la respuesta. Es una herramienta de arranque
   local: fuera de desarrollo no se registra, así que sus rutas dejan de
   existir en lugar de quedar protegidas a medias. */
const seedModules = process.env.NODE_ENV === 'production' ? [] : [SeedModule];
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
    ...seedModules,
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
    GastoModule,
    AssistantModule,
    SearchModule,
    NotificationModule,
  ],
  providers: [
    /* Guard global: las rutas nacen CERRADAS y se abren una a una con
       @Public(). Antes la protección se ponía controller a controller y se
       olvidaba: quedaron 123 endpoints sin autenticar, 73 de ellos mutantes.
       Con esto, olvidarse significa quedar protegido, no expuesto. */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
