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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AuthenticatedUser } from '../types/authenticated-user.interface';
import {
  SearchClientDto,
  ClientListDto,
  UpdateClientDto,
  ChangeClientPasswordDto,
} from '../dto/client-management.dto';
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

  /* Las dos operaciones siguientes son sensibles (una cambia las
     credenciales de acceso y la otra da de baja la cuenta), así que
     quedan fuera del alcance de un administrador de sede. */

  @Patch(':id/password')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Cambiar la contraseña de un cliente',
    description:
      'Fija una contraseña nueva sin pedir la anterior. Pensado para asistencia al cliente.',
  })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async changeClientPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeClientPasswordDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.clientManagementService.changeClientPassword(id, dto.password, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Dar de baja la cuenta de un cliente',
    description:
      'Borra al cliente si no tiene historial. Si tiene citas, pagos, reseñas o gastos, ' +
      'anonimiza sus datos personales y le retira el acceso, conservando esos registros ' +
      'porque sostienen la facturación. La respuesta indica en `mode` cuál de las dos ocurrió.',
  })
  @ApiResponse({ status: 200, description: 'Cuenta eliminada o anonimizada' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async deleteClient(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.clientManagementService.deleteClient(id, user);
  }
}
