import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { FestivoModule } from '../festivo/festivo.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

@Module({
  imports: [PaymentModule, PrismaModule, NotificationModule, FestivoModule],
  controllers: [AppointmentController],
  providers: [AppointmentService, AccessControlService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
