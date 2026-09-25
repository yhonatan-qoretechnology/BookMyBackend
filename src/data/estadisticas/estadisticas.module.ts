import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntityViewModule } from '../entity-view/entity-view.module';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';
import { EmpresaModule } from '../empresa/empresa.module';

@Module({
  imports: [PrismaModule, EmpresaModule, EntityViewModule],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
