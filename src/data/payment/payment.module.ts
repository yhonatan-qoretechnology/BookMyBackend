import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  // EmpresaModule: de ahí salen PlanService/PlanProGuard que usan los
  // endpoints de facturación (@ModuloPro) — sin este import, Nest no
  // puede resolver las dependencias del guard.
  imports: [HttpModule, PrismaModule, EmpresaModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
