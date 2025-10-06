import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ServiceSedeProfesionalController } from './service-sede-profesional.controller';
import { ServiceSedeProfesionalService } from './service-sede-profesional.service';

@Module({
  controllers: [ServiceSedeProfesionalController],
  providers: [ServiceSedeProfesionalService, PrismaService],
  exports: [ServiceSedeProfesionalService],
})
export class ServiceSedeProfesionalModule {}
