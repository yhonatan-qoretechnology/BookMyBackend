import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MembresiaService } from './membresia.service';

export class CheckoutMembresiaDto {
  @ApiProperty({ enum: ['MENSUAL', 'ANUAL'] }) @IsIn(['MENSUAL', 'ANUAL'])
  ciclo: 'MENSUAL' | 'ANUAL';

  @ApiPropertyOptional({ example: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(500)
  sedesExtra?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  empresaId?: number;
}

export class ConfirmarMembresiaDto {
  @ApiProperty() @IsNotEmpty() @IsString()
  sessionId: string;
}

export class PreciosMembresiaDto {
  @ApiProperty({ example: 29 }) @Type(() => Number) @IsNumber() @Min(0.01)
  precioMensual: number;

  @ApiProperty({ example: 290 }) @Type(() => Number) @IsNumber() @Min(0.01)
  precioAnual: number;

  @ApiProperty({ example: 10 }) @Type(() => Number) @IsInt() @Min(1) @Max(1000)
  sedesIncluidas: number;

  @ApiProperty({ example: 9 }) @Type(() => Number) @IsNumber() @Min(0)
  precioSedeExtra: number;

  @ApiProperty({ example: 7 }) @Type(() => Number) @IsInt() @Min(1) @Max(60)
  diasAviso: number;

  @ApiPropertyOptional({ example: 'EUR' }) @IsOptional() @IsString() @Length(3, 3)
  moneda?: string;
}

@ApiTags('Membresía Pro')
@UseGuards(RolesGuard)
@Controller('membresia')
export class MembresiaController {
  constructor(private readonly service: MembresiaService) {}

  @Get('mia')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Plan, vencimiento, precios, sedes y pagos del negocio' })
  mia(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    return this.service.mia(user, empresaId ? Number(empresaId) : undefined);
  }

  @Get('sedes')
  @Roles(Role.COMPANY_ADMIN, Role.BRANCH_ADMIN, Role.SUPER_ADMIN)
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOperation({ summary: 'Sedes usadas y límite del plan' })
  sedes(@AuthUser() user: AuthenticatedUser, @Query('empresaId') empresaId?: string) {
    const id = user.role === Role.SUPER_ADMIN ? Number(empresaId) : user.empresaId;
    return id ? this.service.limiteSedes(id) : { usadas: 0, incluidas: 0, extra: 0, limite: null, pro: false };
  }

  @Post('checkout')
  @Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Pagar la membresía (Stripe Checkout): devuelve la URL de pago' })
  checkout(@AuthUser() user: AuthenticatedUser, @Body() dto: CheckoutMembresiaDto) {
    return this.service.checkout(user, dto);
  }

  @Post('confirmar')
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Al volver de Stripe: aplica el pago si está cobrado' })
  confirmar(@AuthUser() user: AuthenticatedUser, @Body() dto: ConfirmarMembresiaDto) {
    return this.service.confirmar(user, dto.sessionId);
  }

  @Get('admin')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Control de membresías: activas, mensuales/anuales, por vencer, vencidas e ingresos' })
  admin() {
    return this.service.admin();
  }

  @Put('precios')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cambiar precios de Pro y sedes extra' })
  precios(@Body() dto: PreciosMembresiaDto) {
    return this.service.guardarPrecios(dto);
  }
}
