import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FestivoController } from './festivo.controller';
import { FestivoService } from './festivo.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [FestivoController],
  providers: [FestivoService, AccessControlService],
  exports: [FestivoService],
})
export class FestivoModule {}
