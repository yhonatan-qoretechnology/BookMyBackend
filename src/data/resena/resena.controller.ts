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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApproveResenaDto } from './dto/approve-resena.dto';
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
  @ApiBody({ type: ApproveResenaDto })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApproveResenaDto,
  ) {
    return this.resenaService.approve(id, body.aprobado);
  }

  /* El resto del controlador es publico a proposito: la app de
     clientes crea resenas y la web las lee sin sesion. El borrado
     no puede serlo: es destructivo e irreversible. */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una reseña por su ID' })
  @ApiResponse({ status: 204, description: 'Reseña eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.resenaService.remove(id);
  }
}
