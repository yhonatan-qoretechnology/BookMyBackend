import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Alta de una liquidación a un negocio. Se crea siempre, tenga o no
    credenciales reales de Wise configuradas (ver WiseService.isEnabled()). */
export class CrearLiquidacionWiseDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number) @IsInt()
  empresaId: number;

  @ApiProperty({ example: 350.5 })
  @Type(() => Number) @IsNumber() @Min(0.01)
  monto: number;

  @ApiProperty({ example: 'EUR', required: false })
  @IsOptional() @IsString() @MaxLength(3)
  moneda?: string;
}
