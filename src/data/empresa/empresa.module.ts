// src/empresa/empresa.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmpresaController } from './empresa.controller';
import { EmpresaService } from './empresa.service';

@Module({
  controllers: [EmpresaController],
  providers: [EmpresaService, PrismaService],
})
export class EmpresaModule {}
