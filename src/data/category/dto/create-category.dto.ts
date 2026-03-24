import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class TranslationInputDto {
  @ApiProperty({ example: 'es', description: 'Código de idioma' })
  @IsString()
  language: string;

  @ApiProperty({ example: 'Belleza', description: 'Nombre de la categoría' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Servicios de belleza',
    description: 'Descripción',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateCategoryDto {
  @ApiPropertyOptional({
    description: 'URL de la imagen de la categoría (opcional)',
    example: null,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    type: [TranslationInputDto],
    description: 'Lista de traducciones (al menos una requerida)',
    example: [
      {
        language: 'es',
        name: 'Cejas',
        description: 'Diseño y cuidado de cejas',
      },
      {
        language: 'en',
        name: 'Eyebrows',
        description: 'Eyebrow design and care services',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationInputDto)
  translations: TranslationInputDto[];
}

export class BulkCreateCategoriesDto {
  @ApiProperty({
    type: [CreateCategoryDto],
    description: 'Lista de categorías a crear',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCategoryDto)
  categories: CreateCategoryDto[];
}
