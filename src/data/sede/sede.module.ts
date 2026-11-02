import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmpresaService } from '../empresa/empresa.service';
import { SedeController } from './sede.controller';
import { SedeService } from './sede.service';

@Module({
  imports: [PrismaModule],
  controllers: [SedeController],
  /* AccessControlService lo necesitan RolesGuard y SedeAccessGuard. */
  providers: [SedeService, EmpresaService, AccessControlService],
})
export class SedeModule {}
