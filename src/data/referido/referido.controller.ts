import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role, TipoDescuento } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ReferidoClienteService } from './referido-cliente.service';
import { ReferidoService } from './referido.service';

/* ── DTOs ─────────────────────────────────────────────────── */

export class InvitarNegociosDto {
  @ApiProperty({ example: ['amiga@salon.com'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true })
  emails: string[];

  @ApiPropertyOptional({ example: 'Te lo recomiendo, a nosotros nos ahorra horas.' })
  @IsOptional() @IsString() @MaxLength(500)
  mensaje?: string;
}

export class OtorgarMesesDto {
  @ApiProperty() @Type(() => Number) @IsInt()
  empresaId: number;

  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @Min(1) @Max(24)
  meses: number;

  @ApiProperty({ example: 'Regalo por colaborar en la beta' }) @IsNotEmpty() @IsString() @MaxLength(200)
  motivo: string;
}

export class ProgramaClienteDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  empresaId?: number;

  @ApiProperty() @IsBoolean()
  activo: boolean;

  @ApiProperty({ enum: TipoDescuento }) @IsEnum(TipoDescuento)
  tipoReferidor: TipoDescuento;

  @ApiProperty({ example: 15 }) @Type(() => Number) @IsNumber() @Min(0.01) @Max(1000000)
  valorReferidor: number;

  @ApiProperty({ enum: TipoDescuento }) @IsEnum(TipoDescuento)
  tipoInvitado: TipoDescuento;

  @ApiProperty({ example: 10 }) @Type(() => Number) @IsNumber() @Min(0.01) @Max(1000000)
  valorInvitado: number;

  @ApiProperty({ example: 90 }) @Type(() => Number) @IsInt() @Min(0) @Max(730)
  vigenciaDias: number;

  @ApiProperty({ example: 0, description: '0 = sin límite' }) @Type(() => Number) @IsInt() @Min(0) @Max(1000)
  maxPorCliente: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  mensaje?: string;
}

export class RegistrarReferidoClienteDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  empresaId?: number;

  @ApiProperty({ example: 'ANA-7K3' }) @IsNotEmpty() @IsString() @MaxLength(20)
  codigo: string;

  @ApiProperty({ description: 'Cliente que llegó invitado (userId)' }) @Type(() => Number) @IsInt()
  invitadoId: number;
}

export class CanjearCuponDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  empresaId?: number;

  @ApiProperty({ example: 'HOLA-7KX2P' }) @IsNotEmpty() @IsString() @MaxLength(20)
  codigo: string;

  @ApiProperty({ description: 'Ticket al que se aplica' }) @Type(() => Number) @IsInt()
  paymentId: number;
}

const empresaQ = (v?: string) => (v ? Number(v) || undefined : undefined);

/* ── Negocio → negocio ────────────────────────────────────── */

@ApiTags('Referidos')
@Controller('referidos')
export class ReferidoController {
  constructor(private readonly referidos: ReferidoService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('validar/:codigo')
  @ApiOperation({ summary: 'Comprobar un código de invitación de negocio' })
  validar(@Param('codigo') codigo: string) {
    return this.referidos.validar(codigo);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('visita/:codigo')
  @ApiOperation({ summary: 'Cuenta una visita al enlace de invitación' })
  visita(@Param('codigo') codigo: string) {
    return this.referidos.visita(codigo);
  }

  @Get('mio')
  @UseGuards(RolesGuard)
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Código, enlace, embudo, nivel, meses ganados e invitados del negocio' })
  mio(@AuthUser() user: AuthenticatedUser) {
    return this.referidos.mio(user);
  }

  @Post('invitar')
  @UseGuards(RolesGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Invitar por correo a otros negocios (máx. 30 al día)' })
  invitar(@AuthUser() user: AuthenticatedUser, @Body() dto: InvitarNegociosDto) {
    return this.referidos.invitar(user, dto.emails, dto.mensaje);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resumen, ranking y referidos de toda la plataforma' })
  admin() {
    return this.referidos.admin();
  }

  @Post('admin/meses')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Regalar meses de Pro a un negocio' })
  otorgar(@Body() dto: OtorgarMesesDto, @AuthUser() user: AuthenticatedUser) {
    return this.referidos.otorgarMeses(dto, user);
  }

  @Post(':id/anular')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Anular un referido pendiente' })
  anular(@Param('id', ParseIntPipe) id: number) {
    return this.referidos.anular(id);
  }
}

/* ── Cliente → cliente (programa de cada negocio) ─────────── */

@ApiTags('Referidos de clientes')
@Controller('referidos-clientes')
export class ReferidoClienteController {
  constructor(private readonly service: ReferidoClienteService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('validar/:codigo')
  @ApiOperation({ summary: 'Qué regala el código de un cliente (público)' })
  validar(@Param('codigo') codigo: string) {
    return this.service.validarCodigo(codigo);
  }

  @Get('mi-codigo/:empresaId')
  @UseGuards(RolesGuard)
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Cliente (app): su código y cupones disponibles en un negocio' })
  miCodigo(@AuthUser() user: AuthenticatedUser, @Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.service.miCodigo(user, empresaId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Programa, estadísticas, referidos y cupones del negocio' })
  resumen(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    return this.service.resumen(user, empresaQ(empresaId));
  }

  @Put('programa')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Activar y configurar el programa (premios y vigencia)' })
  guardar(@AuthUser() user: AuthenticatedUser, @Body() dto: ProgramaClienteDto) {
    return this.service.guardarPrograma(user, dto);
  }

  @Get('cliente/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Código de invitación de un cliente, sus invitados y cupones' })
  cliente(
    @AuthUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.service.cliente(user, userId, empresaQ(empresaId));
  }

  @Post('registrar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Registrar que un cliente nuevo llegó con el código de otro (le da su cupón de bienvenida)' })
  registrar(@AuthUser() user: AuthenticatedUser, @Body() dto: RegistrarReferidoClienteDto) {
    return this.service.registrar(user, dto);
  }

  @Post('revisar')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Revisar ya los pendientes (si el invitado completó su cita, premia a quien invitó)' })
  revisar(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    return this.service.revisarAhora(user, empresaQ(empresaId));
  }

  @Post(':id/anular')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Anular un referido pendiente (y su cupón de bienvenida sin usar)' })
  anular(
    @AuthUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.service.anular(user, id, empresaQ(empresaId));
  }

  @Get('cupones/validar/:codigo')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiQuery({ name: 'total', required: false })
  @ApiOperation({ summary: 'Comprobar un cupón (y cuánto descuenta sobre un total)' })
  validarCupon(
    @AuthUser() user: AuthenticatedUser,
    @Param('codigo') codigo: string,
    @Query('total') total?: string,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.service.validarCupon(user, codigo, total ? Number(total) : undefined, empresaQ(empresaId));
  }

  @Post('cupones/canjear')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Aplicar un cupón a un ticket' })
  canjear(@AuthUser() user: AuthenticatedUser, @Body() dto: CanjearCuponDto) {
    return this.service.canjear(user, dto);
  }
}
