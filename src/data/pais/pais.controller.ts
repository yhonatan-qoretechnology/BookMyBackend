import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/common/decorators/public.decorator';
import { PaisService } from './pais.service';

@ApiTags('Países')
@Controller('paises')
export class PaisController {
  constructor(private readonly paisService: PaisService) {}

  /* Publico a proposito: el alta de negocio de la web necesita saber en que
     paises se puede operar antes de que exista ninguna sesion, y no son
     datos sensibles. */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Países en los que se puede dar de alta un negocio',
    description:
      'Devuelve la configuración de cada mercado: moneda y sus decimales, locale, zona ' +
      'horaria, límites de precio, cómo se llama aquí el documento fiscal y la división ' +
      'territorial, y si el país tiene festivos regionales. El panel y la web se configuran ' +
      'con esto en vez de llevar las reglas de España escritas en el código.',
  })
  @ApiOkResponse({ description: 'Lista de países activos, ordenada por nombre.' })
  disponibles() {
    return this.paisService.disponibles();
  }
}
