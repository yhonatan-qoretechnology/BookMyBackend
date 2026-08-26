import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'fs';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateServiceWithImagesDto } from '../serviceCategory/dto/create-service-with-images.dto';
import { CreateServiceDto } from '../serviceCategory/dto/create-service.dto';
import { UpdateServiceWithImagesDto } from '../serviceCategory/dto/update-service-with-images.dto';
import { UpdateServiceDto } from '../serviceCategory/dto/update-service.dto';
import { ServiceService } from '../serviceCategory/service.service';

const SERVICE_IMAGES_TEMP_DIR = './uploads/services/temp';

@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  // 🔧 translations/prices/sedeIds viajan como JSON stringificado cuando el
  // body es multipart/form-data (para poder subir imágenes en el mismo
  // request); si ya llegan como objeto (JSON puro) se dejan tal cual.
  private parseJsonField(value: unknown, fieldName: string) {
    if (value === undefined || value === null || value === '') {
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
    } catch {
      throw new BadRequestException(
        `Formato inválido para "${fieldName}". Envía un JSON válido.`,
      );
    }
  }

  private cleanupTempFiles(files?: Express.Multer.File[]) {
    if (!files || files.length === 0) return;
    files.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  }

  // 🟢 Crear un servicio (con imágenes opcionales)
  @Post()
  @ApiOperation({
    summary:
      'Crear servicio con traducciones, precios, sedes e imágenes opcionales',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: CreateServiceWithImagesDto })
  @ApiResponse({ status: 201, description: 'Servicio creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, { dest: SERVICE_IMAGES_TEMP_DIR }),
  )
  async create(
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
    @AuthUser() user?: AuthenticatedUser,
  ) {
    const parsedBody = {
      ...body,
      categoryId:
        body.categoryId !== undefined ? Number(body.categoryId) : undefined,
      translations: this.parseJsonField(body.translations, 'translations'),
      prices: this.parseJsonField(body.prices, 'prices'),
      sedeIds: this.parseJsonField(body.sedeIds, 'sedeIds'),
    };

    const dto = plainToInstance(CreateServiceDto, parsedBody);
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.cleanupTempFiles(files);
      throw new BadRequestException(errors);
    }

    return this.serviceService.create(dto, user, files);
  }

  // 🟡 Actualizar un servicio (permite agregar imágenes a la galería)
  @Put(':id')
  @ApiOperation({
    summary:
      'Actualizar servicio existente (categoría, traducciones, precios, sedes o imágenes)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: UpdateServiceWithImagesDto })
  @ApiResponse({ status: 200, description: 'Servicio actualizado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, { dest: SERVICE_IMAGES_TEMP_DIR }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
    @AuthUser() user?: AuthenticatedUser,
  ) {
    const parsedBody: Record<string, unknown> = {
      ...body,
      categoryId:
        body.categoryId !== undefined ? Number(body.categoryId) : undefined,
      translations: this.parseJsonField(body.translations, 'translations'),
      prices: this.parseJsonField(body.prices, 'prices'),
      sedeIds: this.parseJsonField(body.sedeIds, 'sedeIds'),
    };
    Object.keys(parsedBody).forEach((key) => {
      if (parsedBody[key] === undefined) delete parsedBody[key];
    });

    const dto = plainToInstance(UpdateServiceDto, parsedBody);
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.cleanupTempFiles(files);
      throw new BadRequestException(errors);
    }

    return this.serviceService.update(id, dto, user, files);
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
    summary: 'Eliminar servicio y sus traducciones, precios e imágenes asociadas',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio eliminado correctamente' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.serviceService.remove(id, user);
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
    @AuthUser() user?: AuthenticatedUser,
  ) {
    const dto = { sedeIds };
    return this.serviceService.update(id, dto as any, user);
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

  // 🟢 Obtener todos los servicios de una sede
  @Get('by-sede/:sedeId')
  @ApiOperation({
    summary: 'Listar todos los servicios de una sede',
  })
  @ApiQuery({
    name: 'language',
    enum: ['es', 'en'],
    required: false,
    description: 'Idioma de las traducciones a devolver (por defecto: es)',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de servicios asociados a una sede',
  })
  async findBySede(
    @Param('sedeId') sedeId: string,
    @Query('language') language: string = 'es',
  ) {
    return this.serviceService.findBySede(Number(sedeId), language);
  }

  // 🖼️ Añadir una sola imagen a un servicio existente
  @Post(':id/imagen')
  @ApiOperation({ summary: 'Añadir una imagen a un servicio existente' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Imagen añadida exitosamente.' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo de imagen a subir',
    schema: {
      type: 'object',
      properties: {
        imagen: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('imagen', { dest: SERVICE_IMAGES_TEMP_DIR }),
  )
  async addImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de imagen.');
    }
    return this.serviceService.addImageToService(id, file);
  }

  // 🖼️ Añadir varias imágenes (galería) a un servicio existente
  @Post(':id/imagenes')
  @ApiOperation({
    summary: 'Añadir varias imágenes a un servicio existente (galería)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Imágenes añadidas exitosamente.' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivos de imágenes a subir',
    schema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, { dest: SERVICE_IMAGES_TEMP_DIR }),
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
    return this.serviceService.addImagesToService(id, files);
  }

  // 🖼️ Eliminar imágenes específicas de un servicio
  @Delete(':id/imagenes')
  @ApiOperation({
    summary: 'Eliminar imágenes específicas de un servicio (BD y almacenamiento)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          items: { type: 'string' },
          example: ['uploads/services/1/archivo.png'],
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
  @ApiResponse({ status: 404, description: 'Servicio no encontrado.' })
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
    return this.serviceService.removeImagesFromService(id, imagenes);
  }

  // 🖼️ Reemplazar una imagen específica de un servicio por índice
  @Put(':id/imagenes/:index')
  @ApiOperation({
    summary: 'Reemplazar una imagen específica de un servicio por índice',
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Imagen reemplazada exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Servicio no encontrado o índice inválido.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagen: {
          type: 'string',
          format: 'binary',
          description: 'Nueva imagen para reemplazar la existente',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('imagen', { dest: SERVICE_IMAGES_TEMP_DIR }),
  )
  async replaceImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de imagen.');
    }
    return this.serviceService.replaceImageByIndex(id, index, file);
  }
}
