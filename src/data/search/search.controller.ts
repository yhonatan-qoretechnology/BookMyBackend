import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Búsqueda unificada por palabra clave (categorías, servicios, sedes y profesionales)',
    description:
      'Pensada para resolver consultas abiertas (ej. "manicura", "uñas") en un solo llamado, en vez de encadenar /categories -> /services/category/{id}.',
  })
  @ApiResponse({ status: 200, description: 'Resultados agrupados por tipo.' })
  async search(@Query() dto: SearchQueryDto) {
    return this.searchService.search(dto.q, dto.lang ?? 'es', dto.limit ?? 5);
  }
}
