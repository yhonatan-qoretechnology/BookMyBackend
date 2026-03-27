import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { DisponibilidadProfesionalController } from './disponibilidad-profesional.controller';
import { DisponibilidadProfesionalService } from './disponibilidad-profesional.service';

@Module({
  imports: [PrismaModule],
  controllers: [DisponibilidadProfesionalController],
  providers: [DisponibilidadProfesionalService, AccessControlService],
  exports: [DisponibilidadProfesionalService],
})
export class DisponibilidadProfesionalModule {}
