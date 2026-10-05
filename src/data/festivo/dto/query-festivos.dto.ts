import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFestivosDto {
  @ApiPropertyOptional({ example: 2026, description: 'Año a consultar. Por defecto, el actual.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  anio?: number;

  @ApiPropertyOptional({ example: 3, description: 'Sede: el backend resuelve su comunidad y municipio.' })
  @IsOptional() @Type(() => Number) @IsInt()
  sedeId?: number;

  @ApiPropertyOptional({
    example: 7,
    description:
      'Empresa: devuelve los festivos de TODAS sus sedes juntos. Para el ' +
      'calendario del dueño, que no trabaja sobre una sede concreta.',
  })
  @IsOptional() @Type(() => Number) @IsInt()
  empresaId?: number;

  @ApiPropertyOptional({ example: 'AN', description: 'Comunidad autónoma, si no se pasa sedeId.' })
  @IsOptional() @IsString()
  ccaa?: string;

  @ApiPropertyOptional({ example: 'Benalmádena', description: 'Municipio, si no se pasa sedeId.' })
  @IsOptional() @IsString()
  municipio?: string;
}
