import { Module } from '@nestjs/common';
import { MailModule } from '../email/mail.module';
import { PasswordSetupService } from '../../auth/services/password-setup/password-setup.service';
import { HashService } from '../../auth/services/hash/hash.service';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProfesionalController } from './profesional.controller';
import { ProfesionalService } from './profesional.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [ProfesionalController],
    /* PasswordSetupService y HashService se proveen aqui en vez de importar
     AuthModule entero: solo dependen de Prisma, y asi no se acopla el
     modulo de profesionales al de autenticacion. */
  providers: [
    ProfesionalService,
    AccessControlService,
    PasswordSetupService,
    HashService,
  ],
})
export class ProfesionalModule {}
