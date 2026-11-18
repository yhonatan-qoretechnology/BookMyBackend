import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { MembresiaController } from './membresia.controller';
import { MembresiaService } from './membresia.service';

@Module({
  imports: [PrismaModule, EmpresaModule],
  controllers: [MembresiaController],
  /* RolesGuard necesita AccessControlService en el módulo */
  providers: [MembresiaService, AccessControlService],
  exports: [MembresiaService],
})
export class MembresiaModule {}
