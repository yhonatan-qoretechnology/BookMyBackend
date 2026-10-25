import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EstadoSolicitud, Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ModuloPro } from '../empresa/plan-pro.guard';
import { PlanProGuard } from '../empresa/plan-pro.guard';
import { ActualizarInsumoDto } from './dto/actualizar-insumo.dto';
import { CrearInsumoDto } from './dto/crear-insumo.dto';
import { QuitarImagenesInsumoDto } from './dto/quitar-imagenes-insumo.dto';
import {
  INSUMO_IMAGEN_MAX_BYTES,
  INSUMO_IMAGENES_POR_SUBIDA,
  INSUMO_UPLOAD_TEMP_DIR,
} from './insumo-imagen.constants';
import { insumoImagenFilter } from './insumo-imagen.filter';
import { StockService } from './stock.service';

/**
 * Stock e insumos. Forma parte de Bookmy CRM Pro, igual que facturación y
 * estadísticas, así que pasa por el guard del plan además del de roles.
 *
 * Todo queda acotado a la empresa de la sesión dentro del servicio: no hay
 * forma de pedir el inventario de otro negocio cambiando un id en la URL.
 */
@ApiTags('Stock e insumos')
@Controller('stock')
@UseGuards(RolesGuard, PlanProGuard)
@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
@ModuloPro('Stock e insumos')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  /* ── Catálogo ─────────────────────────────────────────── */

  @Get('insumos')
  @ApiOperation({
    summary: 'Catálogo de insumos del negocio',
    description:
      'Empieza vacío: un negocio recién creado no tiene insumos hasta que los da de alta.',
  })
  @ApiOkResponse({ description: 'Insumos activos, por categoría y nombre.' })
  listarInsumos(
    @AuthUser() user: AuthenticatedUser,
    @Query('empresaId') empresaId?: string,
    @Query('archivados') archivados?: string,
  ) {
    return this.stockService.listarInsumos(
      user,
      empresaId ? Number(empresaId) : undefined,
      archivados === 'true',
    );
  }

  @Post('insumos')
  @ApiOperation({ summary: 'Dar de alta un insumo' })
  crearInsumo(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: CrearInsumoDto,
  ) {
    return this.stockService.crearInsumo(user, body);
  }

  @Patch('insumos/:id')
  @ApiOperation({
    summary: 'Editar un insumo',
    description:
      'Solo cambia lo que se manda. `imagenes` sustituye la lista entera (para reordenar o enlazar fotos de fuera) sin borrar ficheros.',
  })
  actualizarInsumo(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ActualizarInsumoDto,
  ) {
    return this.stockService.actualizarInsumo(user, id, body);
  }

  @Post('insumos/:id/imagenes')
  @ApiOperation({
    summary: 'Subir fotos de un insumo (catálogo web)',
    description:
      'Se añaden al final de `imagenes`. JPG, PNG, WebP o GIF, hasta 10 MB cada una y 12 por insumo. Devuelve el insumo.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        empresaId: {
          type: 'integer',
          description: 'Solo SUPER_ADMIN (también vale ?empresaId=).',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('imagenes', INSUMO_IMAGENES_POR_SUBIDA, {
      dest: INSUMO_UPLOAD_TEMP_DIR,
      limits: { fileSize: INSUMO_IMAGEN_MAX_BYTES },
      fileFilter: insumoImagenFilter,
    }),
  )
  agregarImagenes(
    @AuthUser() user: AuthenticatedUser,
    /* Sin ParseIntPipe: un pipe corre después de multer, y su 400 dejaría
       las fotos en el temporal. Lo valida el servicio, que lo vacía. */
    @Param('id') id: string,
    @UploadedFiles() archivos?: Express.Multer.File[],
    /* En multipart el empresaId del superadmin llega como campo de texto;
       se admite también en la query, como en el resto de rutas. */
    @Body('empresaId') empresaIdCampo?: string,
    @Query('empresaId') empresaIdQuery?: string,
  ) {
    const empresaId = empresaIdCampo || empresaIdQuery;
    return this.stockService.agregarImagenes(
      user,
      id,
      archivos ?? [],
      empresaId ? Number(empresaId) : undefined,
    );
  }

  @Delete('insumos/:id/imagenes')
  @ApiOperation({
    summary: 'Quitar fotos de un insumo (catálogo web)',
    description:
      'Las quita de `imagenes` y borra el fichero cuando lo subió este backend. Devuelve el insumo.',
  })
  quitarImagenes(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: QuitarImagenesInsumoDto,
  ) {
    return this.stockService.quitarImagenes(
      user,
      id,
      body.imagenes,
      body.empresaId,
    );
  }

  @Delete('insumos/:id')
  @ApiOperation({
    summary: 'Archivar un insumo',
    description:
      'No se borra: las solicitudes antiguas lo citan y borrarlo dejaría huecos en el historial.',
  })
  archivarInsumo(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.stockService.archivarInsumo(
      user,
      id,
      empresaId ? Number(empresaId) : undefined,
    );
  }

  /* ── Existencias ──────────────────────────────────────── */

  @Get('sede/:sedeId')
  @ApiOperation({
    summary: 'Existencias de una sede',
    description:
      'Devuelve todo el catálogo: un insumo del que nunca se compró nada sale a cero, no desaparece.',
  })
  stockDeSede(
    @AuthUser() user: AuthenticatedUser,
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.stockService.stockDeSede(
      user,
      sedeId,
      empresaId ? Number(empresaId) : undefined,
    );
  }

  @Patch('sede/:sedeId/insumo/:insumoId')
  @ApiOperation({ summary: 'Ajustar las existencias de un insumo en una sede' })
  ajustarStock(
    @AuthUser() user: AuthenticatedUser,
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Param('insumoId', ParseIntPipe) insumoId: number,
    @Body() body: { stock?: number; max?: number; empresaId?: number },
  ) {
    return this.stockService.ajustarStock(user, sedeId, insumoId, body);
  }

  /* ── Solicitudes de reposición ────────────────────────── */

  @Get('solicitudes')
  @ApiOperation({ summary: 'Pedidos de reposición del negocio' })
  listarSolicitudes(
    @AuthUser() user: AuthenticatedUser,
    @Query('empresaId') empresaId?: string,
    @Query('sedeId') sedeId?: string,
  ) {
    return this.stockService.listarSolicitudes(
      user,
      empresaId ? Number(empresaId) : undefined,
      sedeId ? Number(sedeId) : undefined,
    );
  }

  @Post('solicitudes')
  @ApiOperation({ summary: 'Pedir reposición para una sede' })
  crearSolicitud(
    @AuthUser() user: AuthenticatedUser,
    @Body()
    body: {
      sedeId: number;
      notas?: string;
      items: { insumoId: number; cantidad: number }[];
      empresaId?: number;
    },
  ) {
    return this.stockService.crearSolicitud(user, body);
  }

  @Patch('solicitudes/:id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Aprobar o rechazar un pedido (dueño del negocio)',
    description:
      'Al aprobarlo, las cantidades se suman a las existencias de la sede: es cuando el material entra de verdad.',
  })
  resolverSolicitud(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { estado: EstadoSolicitud; empresaId?: number },
  ) {
    return this.stockService.resolverSolicitud(user, id, body.estado, body.empresaId);
  }
}
