import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post('reservation-client')
  @ApiOperation({
    summary: 'Gestionar cliente para reserva',
    description:
      'Busca un cliente para la reserva. Si no existe, indica que debe ser creado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la búsqueda del cliente',
  })
  async handleReservationClient(@Body() body: { email: string }) {
    return this.appointmentService.searchClient(body.email);
  }

  @Get('search-client')
  @ApiOperation({
    summary: 'Buscar cliente por email para reserva',
    description:
      'Busca un cliente existente por email. Si no existe, devuelve indicación para crearlo.',
  })
  @ApiQuery({
    name: 'email',
    required: false,
    description: 'Email del cliente',
  })
  async searchClient(@Query('email') email?: string) {
    return this.appointmentService.searchClient(email);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva cita' })
  @ApiResponse({ status: 201, description: 'Cita creada correctamente' })
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentService.create(createAppointmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las citas' })
  findAll() {
    return this.appointmentService.findAll();
  }

  @Get('users/:userId/services')
  @ApiOperation({
    summary: 'Listar servicios de un usuario separados por estado',
  })
  getUserServices(@Param('userId', ParseIntPipe) userId: number) {
    return this.appointmentService.getUserServices(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cita por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una cita existente' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(id, updateAppointmentDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una cita' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo?: string,
  ) {
    return this.appointmentService.cancel(id, motivo);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una cita (solo admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.remove(id);
  }
}
