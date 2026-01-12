import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { CreateEmpresaWithFileDto } from '../empresa/dto/create-empresa-with-file.dto';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { EmpresaService } from './empresa.service';

@ApiTags('Empresas')
@Roles(Role.SUPER_ADMIN)
@Controller('empresas')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva empresa con logo' })
  @ApiResponse({ status: 201, description: 'Empresa creada exitosamente.' })
  @ApiBadRequestResponse({
    description:
      'Datos de entrada inválidos o el nombre de la empresa ya existe.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateEmpresaWithFileDto })
  @UseInterceptors(
    FileInterceptor('logo', {
      dest: './uploads/logos',
    }),
  )
  async create(
    @Body() createEmpresaDto: CreateEmpresaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.empresaService.create(createEmpresaDto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las empresas' })
  @ApiResponse({ status: 200, description: 'Lista de todas las empresas.' })
  async findAll() {
    return this.empresaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una empresa por su ID' })
  @ApiResponse({ status: 200, description: 'Empresa encontrada.' })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.empresaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una empresa por su ID, incluyendo el logo',
  })
  @ApiResponse({
    status: 200,
    description: 'Empresa actualizada exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos o el nombre ya está en uso.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateEmpresaWithFileDto })
  @UseInterceptors(
    FileInterceptor('logo', {
      dest: './uploads/logos',
    }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmpresaDto: UpdateEmpresaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.empresaService.update(id, updateEmpresaDto, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una empresa por su ID' })
  @ApiResponse({ status: 204, description: 'Empresa eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.empresaService.remove(id);
  }

  @Patch(':id/logo')
  @ApiOperation({ summary: 'Actualizar únicamente el logo de una empresa' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['logo'],
    },
  })
  @UseInterceptors(
    FileInterceptor('logo', {
      dest: './uploads/logos',
    }),
  )
  async updateLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.empresaService.updateLogo(id, file);
  }
}
