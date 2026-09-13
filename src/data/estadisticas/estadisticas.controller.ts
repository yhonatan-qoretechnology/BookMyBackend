import { Controller, Get, Param, ParseEnumPipe, Query } from '@nestjs/common';
import { ViewEntityType } from '@prisma/client';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryEstadisticasDto } from './dto/query-estadisticas.dto';
import { EstadisticasService } from './estadisticas.service';

@ApiTags('Estadisticas')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  @Get('empresas-con-mas-reservas')
  @ApiOperation({ summary: 'Empresas con mas reservas (2.9)' })
  @ApiOkResponse({ description: 'Ranking de empresas.' })
  empresas(@Query() q: QueryEstadisticasDto) {
    return this.estadisticas.empresasConMasReservas(q);
  }

  @Get('servicios-con-mas-reservas')
  @ApiOperation({ summary: 'Servicios con mas reservas (2.10)' })
  servicios(@Query() q: QueryEstadisticasDto) {
    return this.estadisticas.serviciosConMasReservas(q);
  }

  @Get('empleados')
  @ApiOperation({
    summary: 'Reservas e ingresos por empleado (2.15)',
    description: 'Los ingresos son la suma de los pagos de sus citas; no hay comisiones en el modelo.',
  })
  empleados(@Query() q: QueryEstadisticasDto) {
    return this.estadisticas.empleados(q);
  }

  @Get('ciudades')
  @ApiOperation({ summary: 'Ciudades con mas usuarios (2.8)' })
  ciudades(@Query() q: QueryEstadisticasDto) {
    return this.estadisticas.ciudades(q);
  }

  @Get('mas-vistos/:tipo')
  @ApiOperation({
    summary: 'Lo mas visto del catalogo (2.2-2.5 y 2.7)',
    description: 'tipo: EMPRESA, SEDE, SERVICIO, PROFESIONAL o CATEGORIA.',
  })
  masVistos(
    @Param('tipo', new ParseEnumPipe(ViewEntityType)) tipo: ViewEntityType,
    @Query() q: QueryEstadisticasDto,
  ) {
    return this.estadisticas.masVistos(tipo, q);
  }
}
