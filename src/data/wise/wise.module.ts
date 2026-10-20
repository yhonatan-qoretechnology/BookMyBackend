import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { WiseController } from './wise.controller';
import { WiseService } from './wise.service';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [WiseController],
  /* AccessControlService: RolesGuard la necesita para resolver sus
     dependencias (mismo bug ya visto en FestivoModule/PaymentModule). */
  providers: [WiseService, AccessControlService],
  exports: [WiseService],
})
export class WiseModule {}
