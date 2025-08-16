import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CategoryTranslationDto } from './translation.dto';

export class CreateCategoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto) // Referencia a la clase, no a una instancia
  translations: CategoryTranslationDto[];
}
