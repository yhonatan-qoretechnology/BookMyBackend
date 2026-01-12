import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { DisponibilidadProfesionalController } from './disponibilidad-profesional.controller';
import { DisponibilidadProfesionalService } from './disponibilidad-profesional.service';

@Module({
  controllers: [DisponibilidadProfesionalController],
  providers: [
    DisponibilidadProfesionalService,
    PrismaService,
    AccessControlService,
  ],
  exports: [DisponibilidadProfesionalService],
})
export class DisponibilidadProfesionalModule {}
