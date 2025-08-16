import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { CategoryTranslationDto } from './translation.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto) // Misma referencia que en Create
  translations: CategoryTranslationDto[];
}
