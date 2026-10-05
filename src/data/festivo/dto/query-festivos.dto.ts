import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFestivosDto {
  @ApiPropertyOptional({ example: 2026, description: 'Año a consultar. Por defecto, el actual.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  anio?: number;

  @ApiPropertyOptional({ example: 3, description: 'Sede: el backend resuelve su país, su región y su municipio.' })
  @IsOptional() @Type(() => Number) @IsInt()
  sedeId?: number;

  @ApiPropertyOptional({
    example: 'ES',
    description: 'País en ISO 3166-1 alfa-2, si no se pasa sedeId. Por defecto ES.',
  })
  @IsOptional() @IsString() @Length(2, 2)
  pais?: string;

  @ApiPropertyOptional({
    example: 'AN',
    description:
      'Región en ISO 3166-2 sin el prefijo de país, si no se pasa sedeId. En España es la ' +
      'comunidad autónoma; los países sin festivos regionales (Colombia) la ignoran.',
  })
  @IsOptional() @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'Benalmádena', description: 'Municipio, si no se pasa sedeId.' })
  @IsOptional() @IsString()
  municipio?: string;
}
