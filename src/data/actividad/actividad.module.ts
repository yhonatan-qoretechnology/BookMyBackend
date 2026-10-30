import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ActividadInterceptor } from './actividad.interceptor';
import { ActividadListener } from './actividad.listener';
import { ActividadService } from './actividad.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  providers: [
    ActividadService,
    ActividadListener,
    { provide: APP_INTERCEPTOR, useClass: ActividadInterceptor },
  ],
  exports: [ActividadService],
})
export class ActividadModule {}
