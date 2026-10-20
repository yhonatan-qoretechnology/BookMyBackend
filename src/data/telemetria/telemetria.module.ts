import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { TelemetriaController } from './telemetria.controller';
import { TelemetriaService } from './telemetria.service';

@Module({
  imports: [
    PrismaModule,
    /* Mismo registro local que AuthModule: ThrottlerGuard necesita que
       ThrottlerModule.forRoot() esté en el árbol de este módulo para
       resolver sus dependencias (si no, falla igual que RolesGuard sin
       AccessControlService — ver festivo.module.ts). */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
  ],
  controllers: [TelemetriaController],
  providers: [TelemetriaService, AccessControlService],
  exports: [TelemetriaService],
})
export class TelemetriaModule {}
