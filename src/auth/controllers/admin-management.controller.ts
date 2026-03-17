import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar un administrador por userId' })
  @UseInterceptors(FileInterceptor('photoFile'))
  async updateAdmin(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateAdminUserDto,
    @AuthUser() user: AuthenticatedUser,
    @UploadedFile() photoFile?: Express.Multer.File,
  ) {
    return this.adminManagementService.updateAdminByUserId(
      userId,
      dto,
      user,
      photoFile,
    );
  }

  @Post('companies/:empresaId/admins')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Crear un administrador de empresa (COMPANY_ADMIN) para la empresa indicada',
  })
  @UseInterceptors(FileInterceptor('photoFile'))
  async createCompanyAdmin(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CreateAdminUserDto,
    @AuthUser() user?: AuthenticatedUser,
    @UploadedFile() photoFile?: Express.Multer.File,
  ) {
    return this.adminManagementService.createCompanyAdmin(
      empresaId,
      dto,
      user,
      photoFile,
    );
  }

  @Post('branches/:sedeId/admins')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Crear un administrador de sede (BRANCH_ADMIN) para la sede indicada, devuelve listado y permite actualizar',
  })
  @UseInterceptors(FileInterceptor('photoFile'))
  async createBranchAdmin(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() dto: CreateAdminUserDto,
    @AuthUser() user: AuthenticatedUser,
    @UploadedFile() photoFile?: Express.Multer.File,
  ) {
    await this.adminManagementService.createBranchAdmin(
      sedeId,
      dto,
      user,
      photoFile,
    );
    const admins = await this.adminManagementService.listAdmins(user);
    return {
      message: 'Administrador creado exitosamente',
      admins,
      canUpdate:
        user.role === Role.SUPER_ADMIN || user.role === Role.COMPANY_ADMIN,
    };
  }

  @Delete('admins/:userId')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Eliminar un administrador por userId' })
  @ApiResponse({
    status: 200,
    description: 'Administrador eliminado exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Administrador no encontrado.' })
  async deleteAdmin(
    @Param('userId', ParseIntPipe) userId: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.adminManagementService.deleteAdmin(userId, user);
  }

  @Patch('users/:userId/activate')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Activar un usuario inactivo (Solo SUPER_ADMIN)',
    description:
      'Permite a un super administrador activar cualquier usuario (CLIENT, COMPANY_ADMIN, BRANCH_ADMIN) que esté en estado disabled o blocked.',
  })
  @ApiResponse({ status: 200, description: 'Usuario activado exitosamente.' })
  @ApiResponse({
    status: 403,
    description: 'No tiene permisos para realizar esta acción.',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async activateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.adminManagementService.activateUser(userId, user);
  }
}
