import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { HorarioSedeController } from './horario-sede.controller';
import { HorarioSedeService } from './horario-sede.service';

@Module({
  imports: [PrismaModule],
  controllers: [HorarioSedeController],
  providers: [HorarioSedeService, AccessControlService],
  exports: [HorarioSedeService],
})
export class HorarioSedeModule {}
