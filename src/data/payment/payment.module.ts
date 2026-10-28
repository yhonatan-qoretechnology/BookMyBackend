import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { WiseModule } from '../wise/wise.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  // EmpresaModule: de ahí salen PlanService/PlanProGuard que usan los
  // endpoints de facturación (@ModuloPro) — sin este import, Nest no
  // puede resolver las dependencias del guard.
  // WiseModule: cada pago online cobrado se liquida al negocio.
  imports: [HttpModule, PrismaModule, EmpresaModule, WiseModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
