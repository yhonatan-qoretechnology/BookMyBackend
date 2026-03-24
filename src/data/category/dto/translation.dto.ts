import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CategoryTranslationDto {
  @ApiProperty({
    enum: ['es', 'en'],
    description: 'Language code (es/en)',
    example: 'es',
  })
  @IsIn(['es', 'en'])
  @IsNotEmpty()
  language: string;

  @ApiProperty({
    description: 'Category name in this language',
    example: 'Electrónica',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Optional category description',
    example: 'Productos electrónicos',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
