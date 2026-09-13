import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FestivoController } from './festivo.controller';
import { FestivoService } from './festivo.service';

@Module({
  imports: [PrismaModule],
  controllers: [FestivoController],
  providers: [FestivoService],
  exports: [FestivoService],
})
export class FestivoModule {}
