import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CategoryTranslationDto } from './translation.dto';

export class CreateCategoryDto {
  @ApiPropertyOptional({
    description: 'URL de la imagen de la categoría (opcional)',
    example: 'https://cdn.miapp.com/categories/electronica.png',
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    type: [CategoryTranslationDto],
    description: 'Lista de traducciones (al menos una requerida)',
    example: [
      {
        language: 'es',
        name: 'Belleza',
        description: 'Servicios de belleza y cuidado personal',
      },
      {
        language: 'en',
        name: 'Beauty',
        description: 'Beauty and personal care services',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations: CategoryTranslationDto[];
}
