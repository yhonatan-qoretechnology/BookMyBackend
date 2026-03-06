import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AuthenticatedUser } from '../types/authenticated-user.interface';
import { SearchClientDto, ClientListDto, UpdateClientDto } from '../dto/client-management.dto';
import { ClientManagementService } from '../services/client-management/client-management.service';

@ApiTags('Gestión de Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientManagementController {
  constructor(
    private readonly clientManagementService: ClientManagementService,
  ) {}

  @Post('search')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ 
    summary: 'Buscar cliente por email',
    description: 'Busca un cliente tipo CLIENT por email. Devuelve datos completos del cliente.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cliente encontrado' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Cliente no encontrado' 
  })
  async searchClient(@Body() searchClientDto: SearchClientDto) {
    return this.clientManagementService.searchClient(searchClientDto.email);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ 
    summary: 'Listar clientes con filtros',
    description: 'Devuelve lista paginada de clientes con filtros por email, ID o nombre.'
  })
  async listClients(
    @Query() filters: ClientListDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.clientManagementService.listClients(filters, user);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ 
    summary: 'Obtener cliente por ID',
    description: 'Devuelve todos los datos de un cliente específico.'
  })
  async getClientById(@Param('id', ParseIntPipe) id: number) {
    return this.clientManagementService.getClientById(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ 
    summary: 'Actualizar datos del cliente',
    description: 'Actualiza los datos personales de un cliente existente.'
  })
  async updateClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.clientManagementService.updateClient(id, updateClientDto, user);
  }
}
