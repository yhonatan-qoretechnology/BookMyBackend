import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum LanguageCode {
  ES = 'es',
  EN = 'en',
}

export class CategoryTranslationDto {
  @ApiProperty({
    enum: LanguageCode,
    description: 'Language code (es/en)',
    example: 'es',
  })
  @IsEnum(LanguageCode)
  @IsNotEmpty()
  language: LanguageCode;

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
