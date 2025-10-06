import { Module } from '@nestjs/common';
import { DisponibilidadProfesionalService } from './disponibilidad-profesional.service';
import { DisponibilidadProfesionalController } from './disponibilidad-profesional.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [DisponibilidadProfesionalController],
  providers: [DisponibilidadProfesionalService, PrismaService],
  exports: [DisponibilidadProfesionalService],
})
export class DisponibilidadProfesionalModule {}
