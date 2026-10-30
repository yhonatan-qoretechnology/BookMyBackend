import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from '../email/mail.module';
import { ContactoController } from './contacto.controller';

@Module({
  imports: [
    MailModule,
    /* ThrottlerGuard necesita ThrottlerModule.forRoot() en el árbol de
       este módulo (igual que TelemetriaModule). */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
  ],
  controllers: [ContactoController],
})
export class ContactoModule {}
