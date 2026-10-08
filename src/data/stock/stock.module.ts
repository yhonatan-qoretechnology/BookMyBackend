import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

/* EmpresaModule por el PlanProGuard y AuthModule por el RolesGuard: los
   dos guardan el controlador. */
@Module({
  imports: [PrismaModule, AuthModule, EmpresaModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
