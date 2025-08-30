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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateServiceWithImagesDto } from './dto/create-service-with-images.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceService } from './service.service';

@ApiTags('Servicios')
@Controller('servicios')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo servicio con imágenes' })
  @ApiResponse({
    status: 201,
    description: 'Servicio creado exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateServiceWithImagesDto })
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, { dest: './uploads/servicios/temp' }),
  )
  async create(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.serviceService.create(createServiceDto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los servicios' })
  @ApiResponse({ status: 200, description: 'Lista de todos los servicios.' })
  async findAll() {
    return this.serviceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un servicio por su ID' })
  @ApiResponse({ status: 200, description: 'Servicio encontrado.' })
  @ApiNotFoundResponse({ description: 'Servicio no encontrado.' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un servicio por su ID' })
  @ApiResponse({
    status: 200,
    description: 'Servicio actualizado exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Servicio no encontrado.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un servicio por su ID' })
  @ApiResponse({
    status: 204,
    description: 'Servicio eliminado exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Servicio no encontrado.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.remove(id);
  }
}
