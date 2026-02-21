import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreatePaymentCardDto {
  @ApiProperty({ example: 1, description: 'ID del usuario propietario' })
  @IsInt()
  userId: number;

  @ApiProperty({
    example: '4242424242424242',
    description: 'Número completo de la tarjeta para tokenización',
  })
  @IsString()
  @Length(13, 19)
  @Matches(/^\d+$/)
  cardNumber: string;

  @ApiProperty({ example: 'María Gómez', description: 'Titular de la tarjeta' })
  @IsString()
  cardholderName: string;

  @ApiProperty({ example: 10, description: 'Mes de expiración (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @ApiProperty({ example: 2028, description: 'Año de expiración (YYYY)' })
  @IsInt()
  @Min(2024)
  @Max(2100)
  expiryYear: number;

  @ApiProperty({ example: 'visa', description: 'Marca de la tarjeta' })
  @IsString()
  brand: string;

  @ApiProperty({
    example: true,
    description: 'Permite indicar si se habilita al registrarla',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
