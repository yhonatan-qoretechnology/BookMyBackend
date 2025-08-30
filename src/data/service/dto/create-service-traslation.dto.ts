import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateServiceTranslationDto {
  @ApiProperty({ example: 'es', description: 'Código del idioma' })
  @IsNotEmpty()
  @IsString()
  language: string;

  @ApiProperty({ example: 'Corte de Pelo', description: 'Nombre del servicio' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Corte de pelo moderno con acabado profesional.',
    description: 'Descripción del servicio',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePriceDto {
  @ApiProperty({ example: 30000, description: 'Precio del servicio' })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    example: 60,
    description: 'Duración del servicio en minutos',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  duration?: number;
}
