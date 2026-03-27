import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { DiaCerradoSedeController } from './dia-cerrado-sede.controller';
import { DiaCerradoSedeService } from './dia-cerrado-sede.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiaCerradoSedeController],
  providers: [DiaCerradoSedeService, AccessControlService],
  exports: [DiaCerradoSedeService],
})
export class DiaCerradoSedeModule {}
