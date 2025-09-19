import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CitaService } from './cita.service';
import { CreateCitaDto } from './dto/createCita.dto';
import { UpdateCitaDto } from './dto/update-cita.dto';

@ApiTags('Citas')
@Controller('citas')
export class CitaController {
  constructor(private readonly citaService: CitaService) {}

  @Post()
  @ApiOperation({
    summary: 'Agendar una nueva cita.',
    description:
      'Valida la disponibilidad del profesional y el horario de la sede.',
  })
  @ApiResponse({ status: 201, description: 'Cita agendada exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o conflicto de horario.',
  })
  @ApiResponse({
    status: 404,
    description: 'Sede, servicio o profesional no encontrado.',
  })
  async create(@Body() createCitaDto: CreateCitaDto) {
    return this.citaService.create(createCitaDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una cita existente.',
    description: 'Permite modificar los detalles de una cita por su ID.',
  })
  @ApiResponse({ status: 200, description: 'Cita actualizada exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o conflicto de horario.',
  })
  @ApiResponse({ status: 404, description: 'Cita no encontrada.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCitaDto: UpdateCitaDto,
  ) {
    return this.citaService.update(id, updateCitaDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancelar una cita existente.',
    description: 'Elimina una cita por su ID.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Cita cancelada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.citaService.remove(id);
  }
}
