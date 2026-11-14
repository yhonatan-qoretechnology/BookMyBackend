import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../email/mail.module';
import { ReferidoClienteService } from './referido-cliente.service';
import { ReferidoClienteController, ReferidoController } from './referido.controller';
import { ReferidoListener } from './referido.listener';
import { ReferidoService } from './referido.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    /* ThrottlerGuard y RolesGuard necesitan esto en el árbol del módulo
       (mismo patrón que TelemetriaModule). */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
  ],
  controllers: [ReferidoController, ReferidoClienteController],
  providers: [ReferidoService, ReferidoClienteService, ReferidoListener, AccessControlService],
  exports: [ReferidoService],
})
export class ReferidoModule {}
