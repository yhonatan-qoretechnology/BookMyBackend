import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { HorarioSedeController } from './horario-sede.controller';
import { HorarioSedeService } from './horario-sede.service';

@Module({
  controllers: [HorarioSedeController],
  providers: [HorarioSedeService, PrismaService, AccessControlService],
  exports: [HorarioSedeService],
})
export class HorarioSedeModule {}
