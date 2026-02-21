import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminManagementService } from '../services/admin-management/admin-management.service';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

@ApiTags('Administración de Administradores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminManagementController {
  constructor(
    private readonly adminManagementService: AdminManagementService,
  ) {}

  @Get('admins')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Listar administradores' })
  async listAdmins(@AuthUser() user: AuthenticatedUser) {
    return this.adminManagementService.listAdmins(user);
  }

  @Get('admins/:userId')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Ver detalle de un administrador por userId' })
  async getAdmin(
    @Param('userId', ParseIntPipe) userId: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.adminManagementService.getAdminByUserId(userId, user);
  }

  @Patch('admins/:userId')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Actualizar un administrador por userId' })
  async updateAdmin(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateAdminUserDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.adminManagementService.updateAdminByUserId(userId, dto, user);
  }

  @Post('companies/:empresaId/admins')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Crear un administrador de empresa (COMPANY_ADMIN) para la empresa indicada',
  })
  async createCompanyAdmin(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CreateAdminUserDto,
  ) {
    return this.adminManagementService.createCompanyAdmin(empresaId, dto);
  }

  @Post('branches/:sedeId/admins')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Crear un administrador de sede (BRANCH_ADMIN) para la sede indicada, devuelve listado y permite actualizar',
  })
  async createBranchAdmin(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() dto: CreateAdminUserDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    await this.adminManagementService.createBranchAdmin(sedeId, dto, user);
    const admins = await this.adminManagementService.listAdmins(user);
    return {
      message: 'Administrador creado exitosamente',
      admins,
      canUpdate:
        user.role === Role.SUPER_ADMIN || user.role === Role.COMPANY_ADMIN,
    };
  }
}
