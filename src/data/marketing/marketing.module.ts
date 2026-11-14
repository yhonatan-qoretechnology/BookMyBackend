import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../email/mail.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [PrismaModule, MailModule, EmpresaModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
