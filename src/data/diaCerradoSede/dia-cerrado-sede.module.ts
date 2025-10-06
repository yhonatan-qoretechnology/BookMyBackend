import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DiaCerradoSedeController } from './dia-cerrado-sede.controller';
import { DiaCerradoSedeService } from './dia-cerrado-sede.service';

@Module({
  controllers: [DiaCerradoSedeController],
  providers: [DiaCerradoSedeService, PrismaService],
  exports: [DiaCerradoSedeService],
})
export class DiaCerradoSedeModule {}
