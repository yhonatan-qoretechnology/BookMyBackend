import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReferidoController } from './referido.controller';
import { ReferidoListener } from './referido.listener';
import { ReferidoService } from './referido.service';

@Module({
  imports: [
    PrismaModule,
    /* ThrottlerGuard y RolesGuard necesitan esto en el árbol del módulo
       (mismo patrón que TelemetriaModule). */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
  ],
  controllers: [ReferidoController],
  providers: [ReferidoService, ReferidoListener, AccessControlService],
  exports: [ReferidoService],
})
export class ReferidoModule {}
