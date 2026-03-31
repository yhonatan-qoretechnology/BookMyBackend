import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateResenaDto } from './dto/create-resena.dto';
import { UpdateResenaDto } from './dto/update-resena.dto';
import { ResenaService } from './resena.service';

@ApiTags('Reseñas')
@Controller('resenas')
export class ResenaController {
  constructor(private readonly resenaService: ResenaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva reseña' })
  @ApiResponse({ status: 201, description: 'Reseña creada exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiBody({
    type: CreateResenaDto,
    description: 'Datos para crear una nueva reseña',
  })
  create(@Body() createResenaDto: CreateResenaDto) {
    return this.resenaService.create(createResenaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las reseñas' })
  @ApiResponse({ status: 200, description: 'Lista de todas las reseñas.' })
  findAll() {
    return this.resenaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una reseña por su ID' })
  @ApiResponse({ status: 200, description: 'Reseña encontrada.' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.resenaService.findOne(id);
  }

  @Get('sede/:sedeId')
  @ApiOperation({ summary: 'Obtener reseñas asociadas a una sede' })
  @ApiResponse({ status: 200, description: 'Listado de reseñas de la sede.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  findBySede(@Param('sedeId', ParseIntPipe) sedeId: number) {
    return this.resenaService.findBySede(sedeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una reseña por su ID' })
  @ApiResponse({ status: 200, description: 'Reseña actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  @ApiBody({
    type: UpdateResenaDto,
    description: 'Campos para actualizar la reseña',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateResenaDto: UpdateResenaDto,
  ) {
    return this.resenaService.update(id, updateResenaDto);
  }

  @Patch(':id/aprobar')
  @ApiOperation({ summary: 'Aprobar o rechazar una reseña' })
  @ApiResponse({ status: 200, description: 'Estado de la reseña actualizado.' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        aprobado: {
          type: 'boolean',
          description: 'true para aprobar, false para rechazar',
        },
      },
      required: ['aprobado'],
    },
  })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { aprobado: boolean },
  ) {
    return this.resenaService.approve(id, body.aprobado);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una reseña por su ID' })
  @ApiResponse({ status: 204, description: 'Reseña eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.resenaService.remove(id);
  }
}
