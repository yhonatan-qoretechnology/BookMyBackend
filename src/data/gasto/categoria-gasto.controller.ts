import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AuthUser } from 'src/auth/common/decorators/auth-user.decorator';
import { Roles } from 'src/auth/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
import { CategoriaGastoService } from './categoria-gasto.service';
import { CreateCategoriaGastoDto } from './dto/create-categoria-gasto.dto';

@ApiTags('Categorías de Gasto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
@Controller('categorias-gasto')
export class CategoriaGastoController {
  constructor(private readonly categoriaGastoService: CategoriaGastoService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar categorías de gasto (base + propias de la empresa)',
  })
  async list(@AuthUser() user: AuthenticatedUser) {
    return this.categoriaGastoService.list(user);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una categoría de gasto propia de la empresa' })
  async create(
    @Body() dto: CreateCategoriaGastoDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.categoriaGastoService.create(dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una categoría de gasto propia (no base)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.categoriaGastoService.remove(id, user);
  }
}
