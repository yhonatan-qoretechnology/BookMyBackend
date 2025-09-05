import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateServiceSedeProfesionalDto } from './dto/create-service-sede-profesional.dto';
import { UpdateServiceSedeProfesionalDto } from './dto/update-service-sede-profesional.dto';
import { ServiceSedeProfesionalService } from './service-sede-profesional.service';

@ApiTags('ServiceSedeProfesional')
@Controller('service-sede-profesional')
export class ServiceSedeProfesionalController {
  constructor(
    private readonly serviceSedeProfesionalService: ServiceSedeProfesionalService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crea una nueva relación entre servicio, sede y profesional.',
  })
  @ApiResponse({ status: 201, description: 'Relación creada exitosamente.' })
  create(
    @Body()
    createServiceSedeProfesionalDto: CreateServiceSedeProfesionalDto,
  ) {
    return this.serviceSedeProfesionalService.create(
      createServiceSedeProfesionalDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene todas las relaciones.' })
  findAll() {
    return this.serviceSedeProfesionalService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una relación por su ID.' })
  @ApiResponse({ status: 200, description: 'Relación encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceSedeProfesionalService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza una relación por su ID.' })
  @ApiResponse({ status: 200, description: 'Relación actualizada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateServiceSedeProfesionalDto: UpdateServiceSedeProfesionalDto,
  ) {
    return this.serviceSedeProfesionalService.update(
      id,
      updateServiceSedeProfesionalDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina una relación por su ID.' })
  @ApiResponse({ status: 200, description: 'Relación eliminada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceSedeProfesionalService.remove(id);
  }
}
