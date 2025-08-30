import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PriceDto {
  @ApiProperty({
    example: 25.5,
    description: 'Precio del servicio en euros. Mínimo: 0.50€, Máximo: 1000€',
  })
  @IsNumber()
  @Min(0.5, { message: 'El precio mínimo es 0.50€' })
  @Max(1000, { message: 'El precio máximo es 1000€' })
  amount: number;

  @ApiProperty({
    example: 30,
    description: 'Duración del servicio en minutos. Mínimo: 5 minutos',
  })
  @IsNumber()
  @Min(5, { message: 'La duración mínima es 5 minutos' })
  duration: number;

  @ApiPropertyOptional({
    example: 'EUR',
    default: 'EUR',
    description: 'Moneda (siempre EUR para euros)',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class UpdatePriceDto {
  @ApiPropertyOptional({
    example: 30.0,
    description: 'Precio del servicio en euros',
  })
  @IsNumber()
  @Min(0.5, { message: 'El precio mínimo es 0.50€' })
  @Max(1000, { message: 'El precio máximo es 1000€' })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    example: 45,
    description: 'Duración en minutos',
  })
  @IsNumber()
  @Min(5, { message: 'La duración mínima es 5 minutos' })
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({
    example: 'EUR',
    description: 'Moneda (EUR)',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}
