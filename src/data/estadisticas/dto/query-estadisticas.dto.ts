import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Filtro comun de todas las estadisticas (requisito 2.12).
 *
 * El rango se expresa siempre con desde/hasta en vez de con un enum de
 * "dia/semana/mes/ano": el panel traduce el atajo que elija el usuario a dos
 * fechas, y asi el rango personalizado no necesita un caso aparte.
 */
export class QueryEstadisticasDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Inicio del rango (incluido).' })
  @IsOptional() @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fin del rango (incluido).' })
  @IsOptional() @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ description: 'Acota a una empresa.' })
  @IsOptional() @Type(() => Number) @IsInt()
  empresaId?: number;

  @ApiPropertyOptional({ description: 'Acota a una sede.' })
  @IsOptional() @Type(() => Number) @IsInt()
  sedeId?: number;

  @ApiPropertyOptional({ example: 10, description: 'Cuantas filas devolver.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
