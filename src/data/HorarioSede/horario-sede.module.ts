import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HorarioSedeController } from './horario-sede.controller';
import { HorarioSedeService } from './horario-sede.service';

@Module({
  controllers: [HorarioSedeController],
  providers: [HorarioSedeService, PrismaService],
  exports: [HorarioSedeService],
})
export class HorarioSedeModule {}
