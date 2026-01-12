import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { DisponibilidadProfesionalService } from './disponibilidad-profesional.service';
import { CreateDisponibilidadProfesionalDto } from './dto/create-disponibilidad-profesional.dto';
import { DisponibilidadProfesionalDto } from './dto/disponibilidad-profesional.dto';
import { UpdateDisponibilidadProfesionalDto } from './dto/update-disponibilidad-profesional.dto';

@ApiTags('DisponibilidadProfesional')
@Controller('disponibilidad-profesional')
export class DisponibilidadProfesionalController {
  constructor(private readonly service: DisponibilidadProfesionalService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({
    summary: 'Crear disponibilidad/ausencia para un profesional en una fecha',
  })
  @ApiResponse({ status: 201, type: DisponibilidadProfesionalDto })
  create(
    @Body() dto: CreateDisponibilidadProfesionalDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar disponibilidades (filtros: profesionalId, desde, hasta, disponible)',
  })
  @ApiResponse({ status: 200, description: 'Lista de disponibilidades' })
  findAll(
    @Query('profesionalId') profesionalId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('disponible') disponible?: string,
  ) {
    const params: any = {};
    if (profesionalId) params.profesionalId = Number(profesionalId);
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (disponible !== undefined) params.disponible = disponible === 'true';
    return this.service.findAll(params);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener disponibilidad por ID' })
  @ApiResponse({ status: 200, type: DisponibilidadProfesionalDto })
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Actualizar disponibilidad por ID' })
  @ApiResponse({ status: 200, type: DisponibilidadProfesionalDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDisponibilidadProfesionalDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.service.update(Number(id), dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Eliminar disponibilidad por ID' })
  @ApiResponse({ status: 200, description: 'Eliminado' })
  remove(@Param('id') id: string, @AuthUser() user: AuthenticatedUser) {
    return this.service.remove(Number(id), user);
  }
}
