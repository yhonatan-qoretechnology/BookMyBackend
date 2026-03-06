import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePaymentCardDto {
  @ApiProperty({
    example: 1,
    description: 'ID del usuario propietario de la tarjeta',
  })
  @IsInt()
  userId: number;

  @ApiPropertyOptional({
    example: 'María Gómez',
    description: 'Nombre del titular de la tarjeta',
  })
  @IsOptional()
  @IsString()
  cardholderName?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Mes de expiración (1-12)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth?: number;

  @ApiPropertyOptional({
    example: 2028,
    description: 'Año de expiración (YYYY)',
  })
  @IsOptional()
  @IsInt()
  @Min(2024)
  @Max(2100)
  expiryYear?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Permite activar o desactivar la tarjeta',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
