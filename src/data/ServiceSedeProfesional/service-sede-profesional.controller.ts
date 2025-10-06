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
import { CreateServiceSedeProfesionalDto } from './dto/create-service-sede-profesional.dto';
import { ServiceSedeProfesionalDto } from './dto/service-sede-profesional.dto';
import { UpdateServiceSedeProfesionalDto } from './dto/update-service-sede-profesional.dto';
import { ServiceSedeProfesionalService } from './service-sede-profesional.service';

@ApiTags('ServiceSedeProfesional')
@Controller('service-sede-profesional')
export class ServiceSedeProfesionalController {
  constructor(private readonly service: ServiceSedeProfesionalService) {}

  @Post()
  @ApiOperation({ summary: 'Crear relación (sede - servicio - profesional?)' })
  @ApiResponse({
    status: 201,
    description: 'Creado',
    type: ServiceSedeProfesionalDto,
  })
  create(@Body() dto: CreateServiceSedeProfesionalDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar relaciones (con filtros opcionales: sedeId, serviceId, profesionalId)',
  })
  @ApiResponse({ status: 200, description: 'Lista de relaciones' })
  findAll(
    @Query('sedeId') sedeId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('profesionalId') profesionalId?: string,
  ) {
    const params: any = {};
    if (sedeId) params.sedeId = Number(sedeId);
    if (serviceId) params.serviceId = Number(serviceId);
    if (profesionalId) params.profesionalId = Number(profesionalId);
    return this.service.findAll(params);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener relación por ID' })
  @ApiResponse({
    status: 200,
    description: 'Registro',
    type: ServiceSedeProfesionalDto,
  })
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar relación por ID' })
  @ApiResponse({
    status: 200,
    description: 'Actualizado',
    type: ServiceSedeProfesionalDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceSedeProfesionalDto,
  ) {
    return this.service.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar relación por ID' })
  @ApiResponse({ status: 200, description: 'Eliminado' })
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
