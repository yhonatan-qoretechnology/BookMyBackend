import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateEntityViewDto } from './dto/create-entity-view.dto';
import { EntityViewService } from './entity-view.service';

@ApiTags('Estadisticas')
@Controller('entity-views')
export class EntityViewController {
  constructor(private readonly entityViewService: EntityViewService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar una vista del catalogo',
    description:
      'La llama la app movil al abrir una ficha. Se deduplica por usuario y entidad en una ventana de 30 minutos, para medir interes y no recargas.',
  })
  @ApiCreatedResponse({ description: 'Vista registrada, o ignorada por duplicada.' })
  registrar(@Body() dto: CreateEntityViewDto, @Req() req: any) {
    /* El guard global ya exige token: el usuario sale de ahi y NO del cuerpo,
       para que nadie pueda inflar el ranking declarandose otro. */
    const userId: number | undefined = req.user?.userId;
    return this.entityViewService.registrar(dto, userId);
  }
}
