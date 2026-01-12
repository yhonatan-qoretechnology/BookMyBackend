import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { DiaCerradoSedeController } from './dia-cerrado-sede.controller';
import { DiaCerradoSedeService } from './dia-cerrado-sede.service';

@Module({
  controllers: [DiaCerradoSedeController],
  providers: [DiaCerradoSedeService, PrismaService, AccessControlService],
  exports: [DiaCerradoSedeService],
})
export class DiaCerradoSedeModule {}
