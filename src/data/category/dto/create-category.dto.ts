import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CategoryTranslationDto } from './translation.dto';

export class CreateCategoryDto {
  @ApiProperty({
    type: [CategoryTranslationDto],
    description: 'Translations array (required at least one)',
    example: [
      {
        language: 'es',
        name: 'Electrónica',
        description: 'Productos electrónicos',
      },
      {
        language: 'en',
        name: 'Electronics',
        description: 'Electronic products',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations: CategoryTranslationDto[];
}
