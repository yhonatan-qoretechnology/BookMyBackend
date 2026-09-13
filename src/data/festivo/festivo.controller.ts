import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/common/decorators/public.decorator';
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
}
