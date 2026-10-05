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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlanEmpresa, Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateEmpresaWithFileDto } from '../empresa/dto/create-empresa-with-file.dto';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { EnviarKycDto } from './dto/enviar-kyc.dto';
import { ArchivosKyc, KycService } from './kyc.service';
import { RegistroNegocioDto } from './dto/registro-negocio.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { EmpresaService } from './empresa.service';
import { PlanService } from './plan.service';
import { RegistroNegocioService } from './registro-negocio.service';

@ApiTags('Empresas')
@Controller('empresas')
export class EmpresaController {
  constructor(
    private readonly empresaService: EmpresaService,
    private readonly planService: PlanService,
    private readonly registroNegocio: RegistroNegocioService,
    private readonly kyc: KycService,
  ) {}

  /* ── Alta de un negocio desde la web ──────────────────────
     Pública a propósito: es el formulario de "crear cuenta" de
     bookmy.es. Limitada por IP para que no sirva de fábrica de
     empresas falsas. */
  @Post('registro')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Registrar un negocio nuevo (empresa + primera sede + administrador)',
    description:
      'Crea la cuenta y devuelve la sesión iniciada. Con plan "pro" arranca con 30 días de prueba de Bookmy CRM Pro.',
  })
  @ApiResponse({ status: 201, description: 'Negocio creado; devuelve { user, token }.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos o correo/teléfono/nombre ya en uso.' })
  async registro(@Body() dto: RegistroNegocioDto) {
    return this.registroNegocio.registrar(dto);
  }

  /* ── Plan y prueba ───────────────────────────────────── */
  @Get(':id/plan')
  @ApiOperation({ summary: 'Plan de la empresa y estado de su prueba' })
  async plan(@Param('id', ParseIntPipe) id: number) {
    return this.planService.estadoDe(id);
  }

  @Post(':id/prueba')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Activar los 30 días de prueba de Bookmy CRM Pro',
    description: 'Solo se puede una vez por empresa.',
  })
  async activarPrueba(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.planService.activarPrueba(id, user);
  }

  @Patch(':id/plan')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Cambiar el plan contratado de una empresa (solo SUPER_ADMIN)',
    description: 'Se usa cuando el negocio paga Bookmy CRM Pro o lo deja.',
  })
  async cambiarPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body('plan') plan: PlanEmpresa,
  ) {
    return this.planService.cambiarPlan(id, plan);
  }

  /* ── Verificación de identidad del negocio (KYC) ──────────
     Revisión manual del SUPER_ADMIN. No bloquea nada: la empresa sigue
     trabajando mientras espera. Ojo con el orden de las rutas: esta va
     ANTES de @Get(':id') o "kyc" se tomaría por un id. */
  @Get('kyc/pendientes')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Cola de verificaciones por revisar (solo SUPER_ADMIN)',
    description: 'Las que están EN_REVISION, de la más antigua a la más nueva.',
  })
  async kycPendientes() {
    return this.kyc.pendientes();
  }

  @Get(':id/kyc')
  @ApiOperation({
    summary: 'Estado de la verificación de una empresa',
    description:
      'Accesible para el dueño de esa empresa y para el SUPER_ADMIN. Si nunca ' +
      'envió documentación, devuelve estado PENDIENTE.',
  })
  async kycEstado(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.kyc.estadoDe(id, user);
  }

  @Post(':id/kyc')
  @ApiOperation({
    summary: 'Enviar (o reenviar) la documentación de verificación',
    description:
      'Deja la verificación EN_REVISION. Los archivos que no se manden ' +
      'conservan el valor anterior, para poder corregir solo lo que pidió ' +
      'el superadmin.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nifCif: { type: 'string', example: 'B12345678' },
        documentoTipo: { type: 'string', example: 'DNI' },
        documentoFrente: { type: 'string', format: 'binary' },
        documentoDorso: { type: 'string', format: 'binary' },
        selfie: { type: 'string', format: 'binary' },
        justificante: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Falta el documento del responsable.' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'documentoFrente', maxCount: 1 },
        { name: 'documentoDorso', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
        { name: 'justificante', maxCount: 1 },
      ],
      { dest: './uploads/kyc/temp' },
    ),
  )
  async kycEnviar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnviarKycDto,
    @UploadedFiles() archivos: ArchivosKyc,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.kyc.enviar(id, dto, archivos ?? {}, user);
  }

  @Patch(':id/kyc/aprobar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Aprobar la verificación (solo SUPER_ADMIN)' })
  @ApiNotFoundResponse({ description: 'La empresa no ha enviado documentación.' })
  async kycAprobar(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.kyc.aprobar(id, user);
  }

  @Patch(':id/kyc/rechazar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Rechazar la verificación con un motivo (solo SUPER_ADMIN)',
    description: 'El negocio ve el motivo en su panel y puede volver a enviarla.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { motivo: { type: 'string', example: 'La foto del DNI está ilegible' } },
      required: ['motivo'],
    },
  })
  @ApiBadRequestResponse({ description: 'Falta el motivo del rechazo.' })
  async kycRechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo: string,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.kyc.rechazar(id, motivo, user);
  }

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
    @UploadedFile() file?: Express.Multer.File,
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
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.empresaService.update(id, updateEmpresaDto, file);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una empresa por su ID (solo SUPER_ADMIN)' })
  @ApiResponse({ status: 204, description: 'Empresa eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.empresaService.remove(id);
  }

  @Patch(':id/bloquear')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Bloquear una empresa (solo SUPER_ADMIN)',
    description:
      'No borra ningún dato: impide el login de sus admins/profesionales ' +
      'y que se reserve en sus sedes hasta que se desbloquee.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: { motivo: { type: 'string', example: 'Falta de pago' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Empresa bloqueada.' })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  async bloquear(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo?: string,
  ) {
    return this.empresaService.bloquear(id, motivo);
  }

  @Patch(':id/desbloquear')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Desbloquear una empresa (solo SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Empresa desbloqueada.' })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada.' })
  async desbloquear(@Param('id', ParseIntPipe) id: number) {
    return this.empresaService.desbloquear(id);
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
