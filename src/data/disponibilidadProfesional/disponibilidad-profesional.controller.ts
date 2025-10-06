import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DisponibilidadProfesionalService } from './disponibilidad-profesional.service';
import { CreateDisponibilidadProfesionalDto } from './dto/create-disponibilidad-profesional.dto';
import { DisponibilidadProfesionalDto } from './dto/disponibilidad-profesional.dto';
import { UpdateDisponibilidadProfesionalDto } from './dto/update-disponibilidad-profesional.dto';

@ApiTags('DisponibilidadProfesional')
@Controller('disponibilidad-profesional')
export class DisponibilidadProfesionalController {
  constructor(private readonly service: DisponibilidadProfesionalService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear disponibilidad/ausencia para un profesional en una fecha',
  })
  @ApiResponse({ status: 201, type: DisponibilidadProfesionalDto })
  create(@Body() dto: CreateDisponibilidadProfesionalDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar disponibilidades (filtros: profesionalId, desde, hasta, disponible)',
  })
  @ApiResponse({ status: 200, description: 'Lista de disponibilidades' })
  findAll(
    @Query('profesionalId') profesionalId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('disponible') disponible?: string,
  ) {
    const params: any = {};
    if (profesionalId) params.profesionalId = Number(profesionalId);
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (disponible !== undefined) params.disponible = disponible === 'true';
    return this.service.findAll(params);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener disponibilidad por ID' })
  @ApiResponse({ status: 200, type: DisponibilidadProfesionalDto })
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar disponibilidad por ID' })
  @ApiResponse({ status: 200, type: DisponibilidadProfesionalDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDisponibilidadProfesionalDto,
  ) {
    return this.service.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar disponibilidad por ID' })
  @ApiResponse({ status: 200, description: 'Eliminado' })
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
