import {
  Body,
  Controller,
  Res,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ModuloPro, PlanProGuard } from '../empresa/plan-pro.guard';
import { GuardarCampanaDto, GuardarFiltroDto, VistaPreviaFiltroDto } from './dto/marketing.dto';
import { MarketingService } from './marketing.service';

const empresaQ = (v?: string) => (v ? Number(v) || undefined : undefined);

/**
 * Filtros de clientes y campañas de cada negocio. El superadmin indica la
 * empresa con ?empresaId=; el resto usa la de su sesión.
 */
@ApiTags('Marketing (filtros y campañas)')
@UseGuards(RolesGuard, PlanProGuard)
@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
@ModuloPro('Las campañas')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

  @Get('opciones')
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Ciudades de los clientes, total y canales disponibles' })
  opciones(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    return this.service.opciones(user, empresaQ(empresaId));
  }

  @Get('filtros')
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Filtros guardados (con cuántos clientes cumplen hoy)' })
  listarFiltros(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    return this.service.listarFiltros(user, empresaQ(empresaId));
  }

  @Post('filtros/vista-previa')
  @ApiOperation({ summary: 'Cuántos y qué clientes cumplen unos criterios (sin guardar)' })
  vistaPrevia(@AuthUser() user: AuthenticatedUser, @Body() dto: VistaPreviaFiltroDto) {
    return this.service.vistaPrevia(user, dto.empresaId, dto.criterios);
  }

  @Post('filtros')
  @ApiOperation({ summary: 'Guardar un filtro de clientes' })
  crearFiltro(@AuthUser() user: AuthenticatedUser, @Body() dto: GuardarFiltroDto) {
    return this.service.crearFiltro(user, dto);
  }

  @Patch('filtros/:id')
  @ApiOperation({ summary: 'Editar un filtro guardado' })
  editarFiltro(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarFiltroDto,
  ) {
    return this.service.editarFiltro(user, id, dto);
  }

  @Delete('filtros/:id')
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Borrar un filtro guardado' })
  borrarFiltro(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.service.borrarFiltro(user, id, empresaQ(empresaId));
  }

  @Get('campanas')
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Campañas del negocio' })
  listarCampanas(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    return this.service.listarCampanas(user, empresaQ(empresaId));
  }

  @Post('campanas')
  @ApiOperation({
    summary: 'Crear campaña',
    description: 'Sin fecha se envía al momento; con fecha futura queda programada; con borrador=true no se envía.',
  })
  crearCampana(@AuthUser() user: AuthenticatedUser, @Body() dto: GuardarCampanaDto) {
    return this.service.crearCampana(user, dto);
  }

  @Post('campanas/:id/enviar')
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Enviar ya un borrador o una programada' })
  enviar(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.service.enviarAhora(user, id, empresaQ(empresaId));
  }

  @Post('campanas/:id/cancelar')
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Cancelar un borrador o una programada' })
  cancelar(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.service.cancelar(user, id, empresaQ(empresaId));
  }
}

/* Sin guardas de rol: Twilio (WhatsApp) descarga la imagen sin sesión */
@ApiTags('Marketing (filtros y campañas)')
@Controller('marketing')
export class MarketingPublicoController {
  constructor(private readonly service: MarketingService) {}

  /* Pública: Twilio (WhatsApp) descarga así las imágenes de la campaña */
  @Public()
  @Get('campanas/:id/imagen/:n')
  @ApiOperation({ summary: 'Imagen adjunta de una campaña (pública, para WhatsApp)' })
  async imagen(
    @Param('id', ParseIntPipe) id: number,
    @Param('n', ParseIntPipe) n: number,
    @Res() res: Response,
  ) {
    const img = await this.service.imagen(id, n);
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(img.buffer);
  }
}
