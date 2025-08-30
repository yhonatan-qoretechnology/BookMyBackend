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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProfesionalWithImageDto } from './dto/create-profesional-with-image.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
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
  ) {
    return this.profesionalService.create(createProfesionalDto, file);
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
  ) {
    return this.profesionalService.update(id, updateProfesionalDto);
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
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de imagen.');
    }
    return this.profesionalService.updateImage(id, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un profesional por su ID' })
  @ApiResponse({
    status: 204,
    description: 'Profesional eliminado exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.profesionalService.remove(id);
  }
}
