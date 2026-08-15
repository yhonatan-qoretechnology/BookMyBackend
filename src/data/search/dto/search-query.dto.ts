import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({
    example: 'manicura',
    description: 'Palabra o frase a buscar.',
  })
  @IsString()
  @MinLength(2)
  q: string;

  @ApiPropertyOptional({ example: 'es', default: 'es' })
  @IsOptional()
  @IsString()
  lang?: string;

  @ApiPropertyOptional({
    example: 5,
    default: 5,
    description: 'Máximo de resultados por categoría de dato (servicios, sedes, etc).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
