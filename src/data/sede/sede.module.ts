import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmpresaService } from '../empresa/empresa.service';
import { SedeController } from './sede.controller';
import { SedeService } from './sede.service';

@Module({
  imports: [PrismaModule],
  controllers: [SedeController],
  providers: [SedeService, EmpresaService],
})
export class SedeModule {}
