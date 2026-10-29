import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
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
import { BackupModule } from './data/backup/backup.module';
import { FestivoModule } from './data/festivo/festivo.module';
import { PaisModule } from './data/pais/pais.module';
import { StockModule } from './data/stock/stock.module';
import { CatalogoWebModule } from './data/catalogo-web/catalogo-web.module';
import { EntityViewModule } from './data/entity-view/entity-view.module';
import { EstadisticasModule } from './data/estadisticas/estadisticas.module';
import { TelemetriaModule } from './data/telemetria/telemetria.module';
import { WiseModule } from './data/wise/wise.module';
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
      /* Gana el primero que tenga la variable. El .env apunta a PRODUCCION
         (base de datos, SFTP, JWT, correo); para trabajar en local se crea
         un .env.local, ignorado por git, que lo pisa con la base de
         desarrollo y valores de prueba. En el servidor no hay .env.local y
         todo sigue como siempre. Lo que venga del entorno gana a los dos.
         Ojo: Prisma mete el .env en process.env al importarse, antes de
         llegar aqui, asi que el .env.local lo carga main.ts antes que nada
         (config/env-local.ts); esta lista solo no bastaria. */
      envFilePath: ['.env.local', '.env'],
      validationSchema: Joi.object({
        JWT_SECRET_KEY: Joi.string().required(),
        /* Los enlaces de los correos (confirmar la cuenta, fijar la contrasena
           del empleado nuevo) se construyen con APP_URL y apuntan al PANEL.
           Si falta, MailService cae en http://localhost:3000 y el empleado
           recibe un enlace muerto, sin que nadie se entere.

           Solo se exige en produccion: ahi un despliegue sin la variable es
           mejor que no arranque, mientras que en local y en CI la ausencia
           sigue significando lo de hoy, el valor por defecto del propio
           MailService. `allow('')` deja pasar la variable puesta pero vacia,
           que es como esta en .env.example y hoy tampoco impide arrancar. */
        APP_URL:
          process.env.NODE_ENV === 'production'
            ? Joi.string().required()
            : Joi.string().allow('').optional(),
        SFTP_HOST: Joi.string().optional(),
        SFTP_PORT: Joi.number().optional(),
        SFTP_USER: Joi.string().optional(),
        SFTP_PASSWORD: Joi.string().optional(),
        SFTP_REMOTE_ROOT_PATH: Joi.string().optional(),
        UPLOADS_PUBLIC_BASE_URL: Joi.string().optional(),
        /* Base publica ANTERIOR de los ficheros subidos. Solo sirve para poder
           BORRARLOS: ver SftpStorageService.deleteByPublicUrl. Si no esta
           puesta, el borrado se comporta exactamente como hoy. */
        UPLOADS_PUBLIC_BASE_URL_ANTERIOR: Joi.string().allow('').optional(),
        /* Pasarela de liquidaciones a negocios (WiseService). Sin estas
           tres, WiseService.isEnabled() es false y las liquidaciones
           quedan en PENDIENTE sin llamar a ningún sitio — no hace falta
           tenerlas para desplegar. */
        WISE_API_KEY: Joi.string().optional(),
        WISE_API_URL: Joi.string().optional(),
        WISE_PROFILE_ID: Joi.string().optional(),
        /* Cuenta propia de Bookmy a la que el cliente transfiere cuando
           paga por transferencia (ver WiseService.cuentaReceptora). Sin
           estas dos, el pago queda igual en PENDIENTE pero sin datos de
           cuenta que mostrar. */
        BOOKMY_WISE_IBAN: Joi.string().allow('').optional(),
        BOOKMY_WISE_TITULAR: Joi.string().allow('').optional(),
        /* "local" guarda las subidas en ./uploads aunque esten las SFTP_*
           (ver SftpStorageService.isEnabled). Sin ella, o con "sftp", se
           usa SFTP si esta configurado, como siempre. */
        STORAGE_MODE: Joi.string().valid('local', 'sftp').optional(),
        /* Aviso a la web de un negocio cuando cambia su inventario (ver
           CatalogoWebListener). Sin las tres no se avisa a nadie. */
        CATALOGO_WEB_WEBHOOK_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .allow('')
          .optional(),
        CATALOGO_WEB_WEBHOOK_SECRET: Joi.string().allow('').optional(),
        CATALOGO_WEB_EMPRESA_ID: Joi.number()
          .integer()
          .positive()
          .allow('')
          .optional(),
      }),
    }),
    /* Cron (avisos de prueba/pago vencido) y emisor de eventos de dominio
       (plan-pago.pagado/vencido, trial.por-vencer — ver common/events).
       `wildcard: true` para que el futuro motor de automatizaciones pueda
       suscribirse por patrón en vez de a cada nombre exacto. */
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true }),
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
    FestivoModule,
    BackupModule,
    PaisModule,
    StockModule,
    CatalogoWebModule,
    EntityViewModule,
    EstadisticasModule,
    TelemetriaModule,
    WiseModule,
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
