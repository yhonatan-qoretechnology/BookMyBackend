import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResenaController } from './resena.controller';
import { ResenaService } from './resena.service';

@Module({
  controllers: [ResenaController],
  providers: [ResenaService, PrismaService],
})
export class ResenaModule {}
