import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { CategoryTranslationDto } from './translation.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiProperty({
    type: [CategoryTranslationDto],
    description: 'Array of translations to update',
    example: [
      {
        language: 'es',
        name: 'Electrónica Actualizada',
        description: 'Nueva descripción en español',
      },
      {
        language: 'en',
        name: 'Updated Electronics',
        description: 'nee  description in English',
      },
    ],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations: CategoryTranslationDto[];
}
