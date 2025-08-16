import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateServiceDto } from '../serviceCategory/dto/create-service.dto';
import { UpdateServiceDto } from '../serviceCategory/dto/update-service.dto';
import { ServiceService } from '../serviceCategory/service.service';
@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @ApiOperation({ summary: 'Crear servicio' })
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({ status: 201, description: 'Servicio creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() dto: CreateServiceDto) {
    return this.serviceService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar servicio' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateServiceDto })
  @ApiResponse({ status: 200, description: 'Servicio actualizado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto) {
    return this.serviceService.update(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener servicio por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Detalles del servicio' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.findOne(id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar servicios' })
  @ApiResponse({ status: 200, description: 'Lista de servicios' })
  @ApiQuery({ name: 'language', enum: ['es', 'en'], required: false })
  findAll(@Query('language') language: string = 'es') {
    return this.serviceService.findAll(language);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar servicio' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Servicio eliminado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.remove(id);
  }
}
