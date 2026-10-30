import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../email/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { AutomatizacionController } from './automatizacion.controller';
import { AutomatizacionListener } from './automatizacion.listener';
import { AutomatizacionService } from './automatizacion.service';

@Module({
  imports: [PrismaModule, MailModule, NotificationModule],
  controllers: [AutomatizacionController],
  providers: [AutomatizacionService, AutomatizacionListener, AccessControlService],
})
export class AutomatizacionModule {}
