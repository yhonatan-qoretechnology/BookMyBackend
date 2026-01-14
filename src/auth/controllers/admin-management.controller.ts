import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminManagementService } from '../services/admin-management/admin-management.service';

@ApiTags('Administración de Administradores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminManagementController {
  constructor(
    private readonly adminManagementService: AdminManagementService,
  ) {}

  @Post('companies/:empresaId/admins')
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
  @ApiOperation({
    summary:
      'Crear un administrador de sede (BRANCH_ADMIN) para la sede indicada',
  })
  async createBranchAdmin(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() dto: CreateAdminUserDto,
  ) {
    return this.adminManagementService.createBranchAdmin(sedeId, dto);
  }
}
