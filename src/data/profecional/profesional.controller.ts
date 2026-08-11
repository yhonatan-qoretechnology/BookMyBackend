import {
  BadRequestException,
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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateProfesionalWithImageDto } from './dto/create-profesional-with-image.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { LinkProfesionalAccessDto } from './dto/link-profesional-access.dto';
import { UpdateProfesionalAccessDto } from './dto/update-profesional-access.dto';
import { UpdateProfesionalDto } from './dto/update-profesional.dto';
import { ProfesionalService } from './profesional.service';

@ApiTags('Profesionales')
@Controller('profesionales')
export class ProfesionalController {
  constructor(private readonly profesionalService: ProfesionalService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo profesional con imagen (opcional)' })
  @ApiResponse({ status: 201, description: 'Profesional creado exitosamente.' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o el teléfono ya está en uso.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateProfesionalWithImageDto })
  @UseInterceptors(
    FileInterceptor('imagen', { dest: './uploads/profesionales/temp' }),
  )
  async create(
    @Body() createProfesionalDto: CreateProfesionalDto,
    @UploadedFile() file?: Express.Multer.File,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.profesionalService.create(createProfesionalDto, user, file);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los profesionales' })
  @ApiResponse({
    status: 200,
    description: 'Lista de todos los profesionales.',
  })
  async findAll() {
    return this.profesionalService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un profesional por su ID' })
  @ApiResponse({ status: 200, description: 'Profesional encontrado.' })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.profesionalService.findOne(id);
  }

  @Get(':id/detalle')
  @ApiOperation({
    summary:
      'Obtener un profesional con sus servicios asociados y la información de su sede',
  })
  @ApiResponse({
    status: 200,
    description: 'Profesional con sus servicios y sede.',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async findDetalle(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang: string = 'es',
  ) {
    return this.profesionalService.findProfesionalConServiciosYSede(id, lang);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un profesional por su ID' })
  @ApiResponse({
    status: 200,
    description: 'Profesional actualizado exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProfesionalDto: UpdateProfesionalDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.profesionalService.update(id, updateProfesionalDto, user);
  }

  @Patch(':id/imagen')
  @ApiOperation({ summary: 'Actualizar la imagen de un profesional' })
  @ApiResponse({ status: 200, description: 'Imagen actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo de imagen a subir',
    schema: {
      type: 'object',
      properties: {
        imagen: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('imagen', { dest: './uploads/profesionales/temp' }),
  )
  async updateImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de imagen.');
    }
    return this.profesionalService.updateImage(id, user, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un profesional por su ID' })
  @ApiResponse({
    status: 204,
    description: 'Profesional eliminado exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.profesionalService.remove(id, user);
  }

  @Patch(':id/vincular-acceso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Vincular acceso (login) a un profesional ya existente',
    description:
      'Crea el usuario y las credenciales para un profesional que fue registrado antes de que existiera el login, y lo vincula a su registro. Requiere sesión de administrador (SUPER_ADMIN, COMPANY_ADMIN o BRANCH_ADMIN de su propia sede/empresa).',
  })
  @ApiResponse({ status: 200, description: 'Acceso vinculado correctamente.' })
  @ApiBadRequestResponse({
    description:
      'El profesional ya tiene acceso vinculado o el email ya está en uso.',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async linkAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkProfesionalAccessDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.profesionalService.linkAccess(id, dto, user);
  }

  @Patch(':id/acceso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Actualizar el email y/o la contraseña de acceso de un profesional que ya tiene login',
    description:
      'Permite cambiar el email o resetear la contraseña de un profesional que ya fue vinculado (creado con password o vinculado con "vincular-acceso"). Requiere sesión de administrador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Acceso actualizado correctamente.',
  })
  @ApiBadRequestResponse({
    description:
      'No se envió ningún dato, el profesional no tiene acceso vinculado, o el email ya está en uso.',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async updateAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProfesionalAccessDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.profesionalService.updateAccess(id, dto, user);
  }

  @Get('by-sede/:sedeId')
  @ApiOperation({
    summary: 'Obtener los profesionales de una sede con sus servicios',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de profesionales con sus servicios',
  })
  async findBySede(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Query('lang') lang: string = 'es',
  ) {
    return this.profesionalService.findProfesionalesPorSede(sedeId, lang);
  }

  @Get(':id/servicios-futuros')
  @ApiOperation({
    summary:
      'Obtener los servicios programados de un profesional desde hoy en adelante',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de servicios futuros del profesional',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async findServiciosFuturos(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang: string = 'es',
  ) {
    return this.profesionalService.findServiciosFuturosPorProfesional(id, lang);
  }
}
