import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum LanguageCode {
  ES = 'es',
  EN = 'en',
}

export class ServiceTranslationDto {
  @ApiProperty({
    enum: LanguageCode,
    description: 'Código de idioma ISO 639-1 (es/en)',
    example: 'es',
  })
  @IsEnum(LanguageCode)
  @IsNotEmpty()
  language: LanguageCode;

  @ApiProperty({
    example: 'Corte de pelo',
    description: 'Nombre del servicio en el idioma especificado',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Corte profesional con técnicas modernas',
    description: 'Descripción opcional del servicio',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateServiceTranslationDto extends PartialType(
  ServiceTranslationDto,
) {
  @ApiPropertyOptional({
    enum: LanguageCode,
    example: LanguageCode.ES,
    description: 'Código de idioma ISO 639-1 (es/en)',
  })
  @IsEnum(LanguageCode)
  @IsOptional()
  language?: LanguageCode;

  @ApiPropertyOptional({
    example: 'Corte de pelo actualizado',
    description: 'Nombre del servicio en el idioma especificado',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Nueva descripción del servicio',
    description: 'Descripción opcional del servicio',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
