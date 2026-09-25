import { Controller, Get, Param, ParseEnumPipe, Query, UseGuards } from '@nestjs/common';
import { Role, ViewEntityType } from '@prisma/client';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { QueryEstadisticasDto } from './dto/query-estadisticas.dto';
import { ModuloPro, PlanProGuard } from '../empresa/plan-pro.guard';
import { EstadisticasService } from './estadisticas.service';

@ApiTags('Estadisticas')
/* Las estadísticas son de Bookmy CRM Pro: el panel ya no las enseña en el
   plan gratuito y aquí se cierra la puerta de atrás. */
@ModuloPro('Las estadísticas')
@UseGuards(PlanProGuard)
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  /**
   * Acota el ranking al negocio de quien pregunta.
   *
   * `empresaId` y `sedeId` llegaban solo por query, asi que cualquier usuario
   * con sesion podia pedir el ranking de TODA la plataforma (o el de otro
   * negocio) cambiando un parametro. Con la sesion delante, quien no es
   * SUPER_ADMIN solo ve lo suyo.
   */
  private acotar(
    q: QueryEstadisticasDto,
    user?: AuthenticatedUser,
  ): QueryEstadisticasDto {
    if (!user || user.role === Role.SUPER_ADMIN) return q;
    if (user.role === Role.COMPANY_ADMIN && user.empresaId) {
      return { ...q, empresaId: user.empresaId };
    }
    if (
      (user.role === Role.BRANCH_ADMIN || user.role === Role.EMPLOYEE) &&
      user.sedeId
    ) {
      return { ...q, empresaId: undefined, sedeId: user.sedeId };
    }
    /* Cliente u otro rol sin negocio: nada que rankear. */
    return { ...q, empresaId: -1, sedeId: undefined };
  }

  @Get('empresas-con-mas-reservas')
  @ApiOperation({ summary: 'Empresas con mas reservas (2.9)' })
  @ApiOkResponse({ description: 'Ranking de empresas.' })
  empresas(
    @Query() q: QueryEstadisticasDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.estadisticas.empresasConMasReservas(this.acotar(q, user));
  }

  @Get('servicios-con-mas-reservas')
  @ApiOperation({ summary: 'Servicios con mas reservas (2.10)' })
  servicios(
    @Query() q: QueryEstadisticasDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.estadisticas.serviciosConMasReservas(this.acotar(q, user));
  }

  @Get('empleados')
  @ApiOperation({
    summary: 'Reservas e ingresos por empleado (2.15)',
    description: 'Los ingresos son la suma de los pagos de sus citas; no hay comisiones en el modelo.',
  })
  empleados(
    @Query() q: QueryEstadisticasDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.estadisticas.empleados(this.acotar(q, user));
  }

  @Get('ciudades')
  @ApiOperation({ summary: 'Ciudades con mas usuarios (2.8)' })
  ciudades(
    @Query() q: QueryEstadisticasDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.estadisticas.ciudades(this.acotar(q, user));
  }

  @Get('mas-vistos/:tipo')
  @ApiOperation({
    summary: 'Lo mas visto del catalogo (2.2-2.5 y 2.7)',
    description: 'tipo: EMPRESA, SEDE, SERVICIO, PROFESIONAL o CATEGORIA.',
  })
  masVistos(
    @Param('tipo', new ParseEnumPipe(ViewEntityType)) tipo: ViewEntityType,
    @Query() q: QueryEstadisticasDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.estadisticas.masVistos(tipo, this.acotar(q, user));
  }
}
