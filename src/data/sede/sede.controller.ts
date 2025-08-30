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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSedeWithImagesDto } from './dto/create-sede-with-images.dto';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { SedeService } from './sede.service';

@ApiTags('Sedes')
@Controller('sedes')
export class SedeController {
  constructor(private readonly sedeService: SedeService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva sede con imágenes' })
  @ApiResponse({ status: 201, description: 'Sede creada exitosamente.' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o la empresa no existe.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateSedeWithImagesDto })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, {
      dest: './uploads/sedes/temp',
    }),
  )
  async create(
    @Body() createSedeDto: CreateSedeDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Los campos de horario y diasCerrado se manejarán dentro del servicio
    // porque el @Body() ya los deserializa correctamente.
    return this.sedeService.create(createSedeDto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las sedes' })
  @ApiResponse({ status: 200, description: 'Lista de todas las sedes.' })
  async findAll() {
    return this.sedeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una sede por su ID' })
  @ApiResponse({ status: 200, description: 'Sede encontrada.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sedeService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sede por su ID' })
  @ApiResponse({ status: 200, description: 'Sede actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSedeDto: UpdateSedeDto,
  ) {
    // Asegúrate de que los campos JSON se parseen si es necesario,
    // pero NestJS lo hace automáticamente si el Content-Type es 'application/json'.
    return this.sedeService.update(id, updateSedeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una sede por su ID' })
  @ApiResponse({ status: 204, description: 'Sede eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.sedeService.remove(id);
  }

  @Post(':id/imagenes')
  @ApiOperation({ summary: 'Añadir una imagen a una sede existente' })
  @ApiResponse({ status: 200, description: 'Imagen añadida exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo de imagen a subir',
    type: 'multipart/form-data',
    required: true,
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
    FileInterceptor('imagen', {
      dest: './uploads/sedes/temp',
    }),
  )
  async addImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de imagen.');
    }
    return this.sedeService.addImageToSede(id, file);
  }
}
