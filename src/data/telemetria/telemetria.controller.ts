import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RegistrarAppSessionDto } from './dto/registrar-app-session.dto';
import { RegistrarPageviewDto } from './dto/registrar-pageview.dto';
import { TelemetriaService } from './telemetria.service';

@ApiTags('Telemetria')
@Controller('telemetria')
export class TelemetriaController {
  constructor(private readonly telemetriaService: TelemetriaService) {}

  /* Pública a propósito: la mayoría de las visitas al sitio público no
     tiene sesión. Throttled para que no sirva como ariete de fuerza bruta
     ni de spam del ranking de páginas. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('pageview')
  @ApiOperation({ summary: 'Registrar una visita de página del panel o la web pública' })
  registrarPageview(@Body() dto: RegistrarPageviewDto, @Req() req: any) {
    return this.telemetriaService.registrarPageview({
      ruta: dto.ruta,
      sesionId: dto.sesionId,
      userId: req.user?.userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('app-session')
  @ApiOperation({ summary: 'Registrar la apertura de la app móvil (iOS/Android)' })
  registrarAppSession(@Body() dto: RegistrarAppSessionDto, @Req() req: any) {
    return this.telemetriaService.registrarAppSession({
      plataforma: dto.plataforma,
      ip: req.ip,
    });
  }

  @Get('resumen')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Totales de telemetría (pageviews, sesiones de app, países)' })
  resumen(@Query('dias') dias?: string) {
    return this.telemetriaService.resumen(dias ? parseInt(dias, 10) : undefined);
  }

  @Get('paginas-mas-vistas')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Páginas más visitadas del panel/web pública' })
  paginasMasVistas(@Query('dias') dias?: string, @Query('limit') limit?: string) {
    return this.telemetriaService.paginasMasVistas(
      dias ? parseInt(dias, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('distribucion-plataformas')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Aperturas de la app agrupadas por plataforma y país' })
  distribucionPlataformas(@Query('dias') dias?: string) {
    return this.telemetriaService.distribucionPlataformas(
      dias ? parseInt(dias, 10) : undefined,
    );
  }
}
