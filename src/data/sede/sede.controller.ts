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
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'fs';
import { CreateSedeWithImagesDto } from './dto/create-sede-with-images.dto';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { SedeService } from './sede.service';

@ApiTags('Sedes')
@Controller('sedes')
export class SedeController {
  constructor(private readonly sedeService: SedeService) {}

  // 🟢 Crear una sede con imágenes
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
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const parsedBody = {
      ...body,
      horario: this.parseHorario(body.horario),
      diasCerrado: this.parseDiasCerrado(body.diasCerrado),
    };

    const createSedeDto = plainToInstance(CreateSedeDto, parsedBody);
    const errors = await validate(createSedeDto);

    if (errors.length > 0) {
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
      }
      throw new BadRequestException(errors);
    }
    return this.sedeService.create(createSedeDto, files);
  }

  private parseHorario(value: unknown) {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'object') {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      const normalized = trimmed
        .replace(/([A-Za-zÁÉÍÓÚÜáéíóúüñÑ]+)\s*:/g, '"$1":')
        .replace(/'([^']*)'/g, '"$1"');
      try {
        return JSON.parse(normalized);
      } catch {
        throw new BadRequestException(
          'Formato de horario inválido. Envía un JSON válido.',
        );
      }
    }
  }

  private parseDiasCerrado(value: unknown) {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return items.length > 0 ? items : undefined;
  }

  // 🟢 Obtener todas las sedes
  @Get()
  @ApiOperation({ summary: 'Obtener todas las sedes' })
  @ApiResponse({ status: 200, description: 'Lista de todas las sedes.' })
  async findAll(@Query('withServices') withServices?: string) {
    return this.sedeService.findAll(withServices === 'true');
  }

  // 🟢 Obtener múltiples sedes en una sola request
  @Get('bulk')
  @ApiOperation({ summary: 'Obtener múltiples sedes por IDs' })
  @ApiResponse({ status: 200, description: 'Lista de sedes.' })
  async findBulk(
    @Query('ids') ids?: string,
    @Query('withServices') withServices?: string,
  ) {
    if (!ids) {
      throw new BadRequestException('Debe proporcionar el query param ids');
    }
    const parsed = ids
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (parsed.length === 0) {
      throw new BadRequestException('ids inválidos');
    }
    return this.sedeService.findByIds(parsed, withServices === 'true');
  }

  // 🟢 Obtener todas las sedes de una empresa
  @Get('empresa/:empresaId')
  @ApiOperation({
    summary: 'Obtener todas las sedes relacionadas a una empresa',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de sedes de la empresa especificada.',
  })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  async findByEmpresa(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query('withServices') withServices?: string,
  ) {
    return this.sedeService.findByEmpresa(empresaId, withServices === 'true');
  }

  // 🟢 Obtener una sede por ID
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una sede por su ID' })
  @ApiResponse({ status: 200, description: 'Sede encontrada.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('withServices') withServices?: string,
  ) {
    return this.sedeService.findOne(id, withServices === 'true');
  }

  // 🟢 Actualizar una sede
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sede por su ID' })
  @ApiResponse({ status: 200, description: 'Sede actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSedeDto: UpdateSedeDto,
  ) {
    return this.sedeService.update(id, updateSedeDto);
  }

  // 🟢 Eliminar una sede
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una sede por su ID' })
  @ApiResponse({ status: 204, description: 'Sede eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.sedeService.remove(id);
  }

  // 🟢 Añadir una imagen
  @Post(':id/imagen')
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

  // 🟢 Añadir múltiples imágenes (galería)
  @Post(':id/galeria')
  @ApiOperation({
    summary: 'Añadir varias imágenes a una sede existente (galería)',
  })
  @ApiResponse({ status: 200, description: 'Imágenes añadidas exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivos de imágenes a subir',
    schema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, {
      dest: './uploads/sedes/temp',
    }),
  )
  async addImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'Debe subir al menos un archivo de imagen.',
      );
    }
    return this.sedeService.addImagesToGaleria(id, files);
  }

  // 🟢 Subir imágenes adicionales a una sede
  @Post(':id/imagenes')
  @ApiOperation({ summary: 'Subir imágenes adicionales a una sede' })
  @ApiResponse({ status: 200, description: 'Imágenes añadidas exitosamente.' })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivos de imágenes adicionales a subir',
    schema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, {
      dest: './uploads/sedes/temp',
    }),
  )
  async uploadAdditionalImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'Debe subir al menos un archivo de imagen.',
      );
    }
    return this.sedeService.addImagesToGaleria(id, files);
  }

  // 🟠 Asociar servicios a una sede
  @Post(':id/servicios')
  @ApiOperation({ summary: 'Asociar servicios existentes a una sede' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2, 3],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Servicios asociados exitosamente a la sede.',
  })
  @ApiNotFoundResponse({ description: 'Sede o servicio no encontrado.' })
  async addServices(
    @Param('id', ParseIntPipe) id: number,
    @Body('serviceIds') serviceIds: number[],
  ) {
    if (!serviceIds || serviceIds.length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un ID de servicio.',
      );
    }
    return this.sedeService.addServicesToSede(id, serviceIds);
  }

  // 🔵 Obtener los servicios de una sede
  @Get(':id/servicios')
  @ApiOperation({ summary: 'Obtener todos los servicios asociados a una sede' })
  @ApiResponse({
    status: 200,
    description: 'Servicios obtenidos exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async getServices(@Param('id', ParseIntPipe) id: number) {
    return this.sedeService.getServicesBySede(id);
  }

  // 🔴 Eliminar servicios asociados de una sede
  @Delete(':id/servicios')
  @ApiOperation({ summary: 'Eliminar servicios asociados de una sede' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Servicios desasociados exitosamente de la sede.',
  })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async removeServices(
    @Param('id', ParseIntPipe) id: number,
    @Body('serviceIds') serviceIds: number[],
  ) {
    if (!serviceIds || serviceIds.length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un ID de servicio.',
      );
    }
    return this.sedeService.removeServicesFromSede(id, serviceIds);
  }

  // Eliminar imágenes específicas de una sede
  @Delete(':id/imagenes')
  @ApiOperation({
    summary: 'Eliminar imágenes específicas de una sede (BD y FS)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          items: { type: 'string' },
          example: ['uploads/sedes/1/archivo.png'],
          description:
            'Lista de rutas de imágenes a eliminar (tal como están en la BD)',
        },
      },
      required: ['imagenes'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Imágenes eliminadas exitosamente de la base de datos y del servidor.',
  })
  @ApiNotFoundResponse({ description: 'Sede no encontrada.' })
  async removeImages(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { imagenes: string[] },
  ) {
    const { imagenes } = body;
    if (!imagenes || imagenes.length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos una ruta de imagen para eliminar.',
      );
    }
    return this.sedeService.removeImagesFromSede(id, imagenes);
  }
}
