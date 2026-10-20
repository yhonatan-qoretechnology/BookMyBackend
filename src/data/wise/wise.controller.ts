import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CrearLiquidacionWiseDto } from './dto/crear-liquidacion-wise.dto';
import { WiseService } from './wise.service';

@ApiTags('Wise')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('wise/liquidaciones')
export class WiseController {
  constructor(private readonly wiseService: WiseService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una liquidación a un negocio vía Wise' })
  crear(@Body() dto: CrearLiquidacionWiseDto) {
    return this.wiseService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar liquidaciones (opcionalmente de una empresa)' })
  listar(@Query('empresaId') empresaId?: string) {
    return this.wiseService.listar(empresaId ? parseInt(empresaId, 10) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver el detalle de una liquidación' })
  buscar(@Param('id', ParseIntPipe) id: number) {
    return this.wiseService.buscar(id);
  }
}
