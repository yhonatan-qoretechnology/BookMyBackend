import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmpresaService } from '../empresa/empresa.service';
import { SedeController } from './sede.controller';
import { SedeService } from './sede.service';

@Module({
  controllers: [SedeController],
  providers: [SedeService, PrismaService, EmpresaService],
})
export class SedeModule {}
