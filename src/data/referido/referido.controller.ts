import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { Public } from '../../auth/common/decorators/public.decorator';
import { Roles } from '../../auth/common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ReferidoService } from './referido.service';

export class MovimientoPuntosDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  empresaId: number;

  @ApiProperty({ example: -100, description: 'Negativo = canje; positivo = ajuste a favor.' })
  @Type(() => Number)
  @IsInt()
  puntos: number;

  @ApiProperty({ example: 'Canje: un mes de Pro gratis' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  motivo: string;
}

@ApiTags('Referidos')
@Controller('referidos')
export class ReferidoController {
  constructor(private readonly referidos: ReferidoService) {}

  /* Pública: el formulario de crear cuenta enseña quién te invitó. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('validar/:codigo')
  @ApiOperation({ summary: 'Comprobar un código de referido' })
  validar(@Param('codigo') codigo: string) {
    return this.referidos.validar(codigo);
  }

  @Get('mio')
  @UseGuards(RolesGuard)
  @Roles(Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Código, puntos y referidos del propio negocio' })
  mio(@AuthUser() user: AuthenticatedUser) {
    return this.referidos.mio(user);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resumen, ranking y últimos referidos de toda la plataforma' })
  admin() {
    return this.referidos.admin();
  }

  @Post('movimientos')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Canjear (negativo) o ajustar (positivo) puntos de un negocio' })
  movimiento(@Body() dto: MovimientoPuntosDto, @AuthUser() user: AuthenticatedUser) {
    return this.referidos.movimiento(dto, user);
  }

  @Post(':id/anular')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Anular un referido pendiente' })
  anular(@Param('id', ParseIntPipe) id: number) {
    return this.referidos.anular(id);
  }
}
