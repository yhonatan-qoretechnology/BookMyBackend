import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CitaService } from './cita.service';
import { CreateCitaDto } from './dto/createCita.dto';

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
}
