import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServiceSedeProfesionalController } from './service-sede-profesional.controller';
import { ServiceSedeProfesionalService } from './service-sede-profesional.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceSedeProfesionalController],
  providers: [ServiceSedeProfesionalService, AccessControlService],
})
export class ServiceSedeProfesionalModule {}
