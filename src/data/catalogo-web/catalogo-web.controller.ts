import { Controller, Get, Param, ParseIntPipe, Req, Res } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../auth/common/decorators/public.decorator';
import { CatalogoWebService } from './catalogo-web.service';

@ApiTags('Catálogo web')
@Controller('catalogo-web')
export class CatalogoWebController {
  constructor(private readonly catalogoWeb: CatalogoWebService) {}

  /* Publico a proposito: es el escaparate de la web del negocio, que lo pide
     desde su servidor y sin sesion. Solo sale lo que el negocio ha publicado,
     sin costes ni sedes. */
  @Public()
  @Get(':empresaId')
  @ApiOperation({
    summary: 'Catálogo de la web de un negocio',
    description:
      'Los insumos activos y publicados en la web (publicadoWeb), con el stock sumado de ' +
      'todas sus sedes. Ordenados por ordenWeb, los que no tienen al final, y después por ' +
      'id. Las fotos salen con URL completa. No hace falta Pro.',
  })
  @ApiParam({ name: 'empresaId', example: 14 })
  @ApiOkResponse({
    description:
      '{ empresa: { id, nombre }, actualizadoEn, productos: [{ id, nombre, categoria, ' +
      'subcategoria, marca, etiqueta, descripcion, descripcionLarga, precio, imagenes, ' +
      'especificaciones, conVariantes, stock, disponible, orden }] }',
  })
  @ApiNotFoundResponse({ description: 'El negocio no existe.' })
  async catalogo(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const catalogo = await this.catalogoWeb.catalogo(
      empresaId,
      `${req.protocol}://${req.get('host')}`,
    );
    /* Aqui y no con @Header(), que lo pone tambien en los errores: un 404 o
       un 500 no deben quedarse cacheados. */
    res.setHeader('Cache-Control', 'public, max-age=30');
    return catalogo;
  }
}
