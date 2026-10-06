import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { QueryFestivosDto } from './dto/query-festivos.dto';
import { FestivoService } from './festivo.service';

@ApiTags('Festivos')
@Controller('festivos')
export class FestivoController {
  constructor(private readonly festivoService: FestivoService) {}

  /* Publico a proposito: el calendario del panel y la app movil los pintan,
     y no son datos sensibles (son los festivos oficiales de Espana). */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Festivos que aplican a una sede',
    description:
      'Nacionales + los de su comunidad + los de su municipio. Son informativos: no bloquean el agendado.',
  })
  @ApiOkResponse({ description: 'Lista de festivos ordenada por fecha.' })
  findAll(@Query() query: QueryFestivosDto) {
    return this.festivoService.findAll(query);
  }

  /* Tiene que ir ANTES de cualquier :param y es publico por lo mismo que
     el listado: el panel lo pide a la vez. */
  @Public()
  @Get('contexto')
  @ApiOperation({
    summary: 'Que se le aplica a una sede: pais, region y municipio',
    description:
      'Lo que el panel escribe encima del calendario para que se vea de donde salen ' +
      'los festivos y se note cuando una sede tiene el municipio mal cargado.',
  })
  @ApiOkResponse({ description: 'Pais, regiones y municipios resueltos, y el detalle por sede.' })
  contexto(@Query() query: QueryFestivosDto) {
    return this.festivoService.contexto(query);
  }

  @Post('sincronizar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Sincroniza los festivos de un país y un año (solo SUPER_ADMIN)',
    description:
      'Trae los festivos oficiales desde calendariosnacionales.com y los guarda localmente. ' +
      'En España son los nacionales más los de las 19 comunidades y ciudades autónomas; en ' +
      'Colombia son los 18 nacionales de la Ley 51/1983, sin festivos regionales. No trae ' +
      'festivos locales (municipio), esos se siguen cargando a mano. Pensado para correrse ' +
      'una vez al año, cuando se publican los calendarios del año siguiente.',
  })
  @ApiOkResponse({
    description:
      'Resumen de lo sincronizado: país, cuántos nacionales, cuántos regionales y qué regiones fallaron, si alguna.',
  })
  sincronizar(
    @Body('anio', ParseIntPipe) anio: number,
    /* Sin país se sincroniza España, que es como se comportaba esto antes
       de que hubiera más de un país. */
    @Body('pais') pais?: string,
  ) {
    return this.festivoService.sincronizarAnio(anio, pais);
  }

  /* ── Festivos locales (los del municipio) ─────────────────
     La API externa solo publica nacionales y regionales. Los patronos de
     cada pueblo —los que hacen que Benalmádena y Marbella no cierren los
     mismos días— se cargan aquí a mano. */
  @Get('locales')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Festivos locales cargados de un año (solo SUPER_ADMIN)' })
  locales(@Query('anio') anio?: string, @Query('pais') pais?: string) {
    return this.festivoService.locales(anio ? Number(anio) : undefined, pais);
  }

  @Post('local')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Añadir un festivo local (solo SUPER_ADMIN)',
    description:
      'El municipio se compara sin tildes y sin mayúsculas, así que da igual ' +
      'escribir "Benalmádena" o "Benalmadena".',
  })
  crearLocal(
    @Body() body: { fecha: string; nombre: string; municipio: string; pais?: string },
  ) {
    return this.festivoService.crearLocal(body);
  }

  @Delete('local/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Quitar un festivo local (solo SUPER_ADMIN)' })
  borrarLocal(@Param('id', ParseIntPipe) id: number) {
    return this.festivoService.borrarLocal(id);
  }
}
