// src/empresa/empresa.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmpresaController } from './empresa.controller';
import { EmpresaService } from './empresa.service';
import { PlanProGuard } from './plan-pro.guard';
import { PlanService } from './plan.service';
import { RegistroNegocioService } from './registro-negocio.service';

@Module({
  /* forwardRef: el alta de un negocio devuelve la sesión iniciada, así que
     necesita AuthService, y auth a su vez usa este módulo para resolver el
     plan de la empresa al iniciar sesión. */
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [EmpresaController],
  providers: [EmpresaService, PlanService, RegistroNegocioService, PlanProGuard],
  exports: [PlanService, PlanProGuard],
})
export class EmpresaModule {}
