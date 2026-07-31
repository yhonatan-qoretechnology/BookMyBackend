import { Module } from '@nestjs/common';

import { AccessControlService } from 'src/auth/services/access-control/access-control.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CategoriaGastoController } from './categoria-gasto.controller';
import { CategoriaGastoService } from './categoria-gasto.service';
import { GastoController } from './gasto.controller';
import { GastoService } from './gasto.service';

@Module({
  imports: [PrismaModule],
  controllers: [GastoController, CategoriaGastoController],
  providers: [GastoService, CategoriaGastoService, AccessControlService],
})
export class GastoModule {}
