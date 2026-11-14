import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../email/mail.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [PrismaModule, MailModule, EmpresaModule],
  controllers: [MarketingController],
  /* RolesGuard necesita AccessControlService en el módulo */
  providers: [MarketingService, AccessControlService],
})
export class MarketingModule {}
