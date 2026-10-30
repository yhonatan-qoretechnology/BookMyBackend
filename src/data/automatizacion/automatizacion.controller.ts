import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, SegmentoCampana } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { AutomatizacionService } from './automatizacion.service';
import {
  ActualizarAutomatizacionDto,
  ActualizarCampanaDto,
  CrearAutomatizacionDto,
  CrearCampanaDto,
} from './dto/automatizacion.dto';

@ApiTags('Automatizaciones')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('automatizaciones')
export class AutomatizacionController {
  constructor(private readonly motor: AutomatizacionService) {}

  @Get('eventos')
  @ApiOperation({ summary: 'Eventos que pueden disparar una automatización y variables disponibles' })
  eventos() {
    return this.motor.eventos();
  }

  @Get()
  @ApiOperation({ summary: 'Listar automatizaciones' })
  listar() {
    return this.motor.listar();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una automatización' })
  crear(@Body() dto: CrearAutomatizacionDto, @AuthUser() user: AuthenticatedUser) {
    return this.motor.crear(dto, user);
  }

  @Get('ejecuciones')
  @ApiOperation({ summary: 'Últimas ejecuciones (de todas o de una automatización)' })
  ejecuciones(@Query('automatizacionId') automatizacionId?: string) {
    return this.motor.ejecuciones(automatizacionId ? Number(automatizacionId) : undefined);
  }

  /* ── Campañas (rutas estáticas antes que ':id') ─────────── */
  @Get('campanas')
  @ApiOperation({ summary: 'Listar campañas de correo' })
  campanas() {
    return this.motor.campanas();
  }

  @Get('campanas/destinatarios')
  @ApiOperation({ summary: 'Cuántos negocios recibirían una campaña de ese segmento' })
  destinatarios(@Query('segmento') segmento: SegmentoCampana = SegmentoCampana.TODAS) {
    return this.motor.contarSegmento(
      Object.values(SegmentoCampana).includes(segmento) ? segmento : SegmentoCampana.TODAS,
    );
  }

  @Post('campanas')
  @ApiOperation({ summary: 'Crear una campaña (con fecha = programada; sin fecha = borrador)' })
  crearCampana(@Body() dto: CrearCampanaDto, @AuthUser() user: AuthenticatedUser) {
    return this.motor.crearCampana(dto, user);
  }

  @Patch('campanas/:id')
  @ApiOperation({ summary: 'Editar o reprogramar una campaña no enviada' })
  actualizarCampana(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarCampanaDto) {
    return this.motor.actualizarCampana(id, dto);
  }

  @Post('campanas/:id/cancelar')
  @ApiOperation({ summary: 'Cancelar una campaña no enviada' })
  cancelarCampana(@Param('id', ParseIntPipe) id: number) {
    return this.motor.cancelarCampana(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o activar/desactivar una automatización' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAutomatizacionDto) {
    return this.motor.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una automatización (y su historial)' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.motor.eliminar(id);
  }
}
