import {
  Body,
  Controller,
  Get,
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

  @Post('sincronizar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Sincroniza festivos nacionales y autonómicos de un año (solo SUPER_ADMIN)',
    description:
      'Trae los festivos oficiales de las 19 comunidades/ciudades autónomas de España desde ' +
      'calendariosnacionales.com y los guarda localmente. No trae festivos locales (municipio), ' +
      'esos se siguen cargando a mano. Pensado para correrse una vez al año, cuando se publican ' +
      'los calendarios oficiales del año siguiente (octubre-noviembre).',
  })
  @ApiOkResponse({
    description: 'Resumen de lo sincronizado: cuántos nacionales, cuántos autonómicos, y qué comunidades fallaron (si alguna).',
  })
  sincronizar(@Body('anio', ParseIntPipe) anio: number) {
    return this.festivoService.sincronizarAnio(anio);
  }
}
