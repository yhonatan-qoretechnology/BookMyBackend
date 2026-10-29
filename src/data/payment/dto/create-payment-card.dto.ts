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
  ValidateIf,
} from 'class-validator';

export class CreatePaymentCardDto {
  @ApiProperty({ example: 1, description: 'ID del usuario propietario' })
  @IsInt()
  userId: number;

  @ApiProperty({
    example: '4242',
    required: false,
    description:
      'Últimos 4 dígitos. Es lo que manda la app: por PCI-DSS el número completo no debe viajar a este servidor.',
  })
  @ValidateIf((o) => !o.cardNumber)
  @IsString()
  @Matches(/^\d{4}$/)
  last4?: string;

  @ApiProperty({
    example: '4242424242424242',
    required: false,
    description:
      'Número completo (compatibilidad). Solo se conservan los últimos 4 dígitos.',
  })
  @ValidateIf((o) => !o.last4)
  @IsString()
  @Length(13, 19)
  @Matches(/^\d+$/)
  cardNumber?: string;

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
