import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AuthUser } from 'src/auth/common/decorators/auth-user.decorator';
import { Roles } from 'src/auth/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import {
  GASTO_MAX_FILE_SIZE_BYTES,
  GASTO_UPLOAD_TEMP_DIR,
} from './gasto-file.constants';
import { gastoFileFilter } from './gasto-file.filter';
import { GastoService } from './gasto.service';

@ApiTags('Gastos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
@Controller('gastos')
export class GastoController {
  constructor(private readonly gastoService: GastoService) {}

  @Get('filter')
  @ApiOperation({
    summary: 'Filtrar gastos por sede y/o empresa según el alcance del usuario',
  })
  @ApiQuery({ name: 'sedeId', required: false })
  @ApiQuery({ name: 'empresaId', required: false })
  async filter(
    @AuthUser() user: AuthenticatedUser,
    @Query('sedeId') sedeId?: string,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.gastoService.filterGastos(user, {
      sedeId: sedeId ? Number(sedeId) : undefined,
      empresaId: empresaId ? Number(empresaId) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un gasto' })
  async create(
    @Body() dto: CreateGastoDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.gastoService.createGasto(dto, user);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Subir el comprobante (ticket) de un gasto' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Comprobante a subir (imagen o PDF)',
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      dest: GASTO_UPLOAD_TEMP_DIR,
      limits: { fileSize: GASTO_MAX_FILE_SIZE_BYTES },
      fileFilter: gastoFileFilter,
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo (imagen o PDF).');
    }

    return this.gastoService.storeGastoFile(file);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un gasto' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGastoDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.gastoService.updateGasto(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un gasto' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.gastoService.removeGasto(id, user);
  }
}
