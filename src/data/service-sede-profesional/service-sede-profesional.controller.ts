import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
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
  @Public()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({
    summary: 'Crea una nueva relación entre servicio, sede y profesional.',
  })
  @ApiResponse({ status: 201, description: 'Relación creada exitosamente.' })
  create(
    @Body()
    createServiceSedeProfesionalDto: CreateServiceSedeProfesionalDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.serviceSedeProfesionalService.create(
      createServiceSedeProfesionalDto,
      user,
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
  @UseGuards(JwtAuthGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Actualiza una relación por su ID.' })
  @ApiResponse({ status: 200, description: 'Relación actualizada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateServiceSedeProfesionalDto: UpdateServiceSedeProfesionalDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.serviceSedeProfesionalService.update(
      id,
      updateServiceSedeProfesionalDto,
      user,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Elimina una relación por su ID.' })
  @ApiResponse({ status: 200, description: 'Relación eliminada.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.serviceSedeProfesionalService.remove(id, user);
  }
}
