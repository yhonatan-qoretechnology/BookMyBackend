import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { CategoryTranslationDto } from './translation.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({
    description: 'Nueva URL o ruta de la imagen de la categoría (opcional)',
    example: 'https://cdn.miapp.com/categories/new-electronics.png',
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    type: [CategoryTranslationDto],
    description: 'Traducciones actualizadas',
    example: [
      {
        language: 'es',
        name: 'Electrónica Actualizada',
        description: 'Nueva descripción en español',
      },
      {
        language: 'en',
        name: 'Updated Electronics',
        description: 'Updated description in English',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations: CategoryTranslationDto[];
}
