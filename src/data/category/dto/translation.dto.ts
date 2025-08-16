import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum LanguageCode {
  ES = 'es',
  EN = 'en',
}

export class CategoryTranslationDto {
  @ApiProperty({ enum: LanguageCode })
  @IsEnum(LanguageCode)
  @IsNotEmpty()
  language: LanguageCode;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  description?: string;
}
