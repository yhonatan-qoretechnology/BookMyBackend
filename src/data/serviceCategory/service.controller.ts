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

  // 🟢 Crear un servicio
  @Post()
  @ApiOperation({
    summary: 'Crear servicio con traducciones, precios y sedes opcionales',
  })
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({ status: 201, description: 'Servicio creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() dto: CreateServiceDto) {
    return this.serviceService.create(dto);
  }

  // 🟡 Actualizar un servicio
  @Put(':id')
  @ApiOperation({
    summary:
      'Actualizar servicio existente (categoría, traducciones, precios o sedes)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiBody({ type: UpdateServiceDto })
  @ApiResponse({ status: 200, description: 'Servicio actualizado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto) {
    return this.serviceService.update(id, dto);
  }

  // 🔵 Listar todos los servicios (filtrando idioma)
  @Get()
  @ApiOperation({
    summary: 'Listar servicios con traducción filtrada por idioma',
  })
  @ApiQuery({
    name: 'language',
    enum: ['es', 'en'],
    required: false,
    description: 'Idioma de las traducciones a devolver (por defecto: es)',
  })
  @ApiResponse({ status: 200, description: 'Lista de servicios' })
  findAll(@Query('language') language: string = 'es') {
    return this.serviceService.findAll(language);
  }

  // 🟠 Obtener un servicio específico
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener servicio por su ID con detalles completos',
  })
  @ApiQuery({
    name: 'language',
    enum: ['es', 'en'],
    required: false,
    description: 'Idioma de las traducciones a devolver (por defecto: es)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Detalles del servicio' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(
    @Query('language') language: string = 'es',
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.serviceService.findOne(id, language);
  }

  // 🔴 Eliminar un servicio
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar servicio y sus traducciones y precios asociados',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio eliminado correctamente' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.remove(id);
  }

  // 🧩 Endpoint opcional: actualizar solo las sedes del servicio
  @Put(':id/sedes')
  @ApiOperation({
    summary: 'Actualizar solo las sedes asociadas a un servicio',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sedeIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3],
          description: 'IDs de las sedes asociadas al servicio',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Sedes actualizadas correctamente' })
  async updateSedes(
    @Param('id', ParseIntPipe) id: number,
    @Body('sedeIds') sedeIds: number[],
  ) {
    const dto = { sedeIds };
    return this.serviceService.update(id, dto as any);
  }

  // 🔵 Listar servicios por categoría (filtrando idioma)
  @Get('category/:categoryId')
  @ApiOperation({
    summary:
      'Listar servicios por categoría con traducción filtrada por idioma',
  })
  @ApiQuery({
    name: 'language',
    enum: ['es', 'en'],
    required: false,
    description: 'Idioma de las traducciones a devolver (por defecto: es)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de servicios filtrados por categoría e idioma',
  })
  async getByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Query('language') language: string = 'es', // idioma por defecto
  ) {
    return this.serviceService.findByCategory(categoryId, language);
  }
}
