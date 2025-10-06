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
import { HorarioSedeService } from './horario-sede.service';
import { CreateHorarioSedeDto } from './dto/create-horario-sede.dto';
import { UpdateHorarioSedeDto } from './dto/update-horario-sede.dto';
import { HorarioSedeDto } from './dto/horario-sede.dto';

@ApiTags('HorarioSede')
@Controller('horario-sede')
export class HorarioSedeController {
  constructor(private readonly service: HorarioSedeService) {}

  @Post()
  @ApiOperation({ summary: 'Crear horario semanal para una sede' })
  @ApiResponse({
    status: 201,
    description: 'Horario creado',
    type: HorarioSedeDto,
  })
  create(@Body() dto: CreateHorarioSedeDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar horarios (filtrar por sedeId o activo)' })
  @ApiResponse({ status: 200, description: 'Lista de horarios' })
  findAll(@Query('sedeId') sedeId?: string, @Query('activo') activo?: string) {
    const params: any = {};
    if (sedeId) params.sedeId = Number(sedeId);
    if (activo !== undefined) params.activo = activo === 'true';
    return this.service.findAll(params);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener horario por ID' })
  @ApiResponse({
    status: 200,
    description: 'Horario encontrado',
    type: HorarioSedeDto,
  })
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar horario por ID' })
  @ApiResponse({
    status: 200,
    description: 'Horario actualizado',
    type: HorarioSedeDto,
  })
  update(@Param('id') id: string, @Body() dto: UpdateHorarioSedeDto) {
    return this.service.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar horario por ID' })
  @ApiResponse({ status: 200, description: 'Horario eliminado' })
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
