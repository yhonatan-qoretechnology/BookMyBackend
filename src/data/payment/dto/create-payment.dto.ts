import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: 1,
    description: 'ID del usuario que realiza el pago',
  })
  @IsNumber()
  userId: number;

  @ApiProperty({ example: 1, description: 'ID de la cita asociada al pago' })
  @IsNumber()
  appointmentId: number;

  @ApiProperty({
    example: 'CARD',
    enum: PaymentMethod,
    description: 'Método de pago: CARD o CASH',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    example: 100,
    description:
      'Monto total a pagar (solo si se quiere forzar un valor específico)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({
    example: 10,
    description: 'Mes de expiración (1-12) de la tarjeta',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  expiryMonth?: number;

  @ApiProperty({
    example: 2027,
    description: 'Año de expiración de la tarjeta (YYYY)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  expiryYear?: number;

  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre del titular de la tarjeta',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardholderName?: string;

  @ApiProperty({
    example: 'visa',
    description: 'Marca de la tarjeta utilizada',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardBrand?: string;

  @ApiProperty({
    example: '4242424242424242',
    description: 'Número de tarjeta (solo para método CARD)',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiProperty({
    example: '123',
    description: 'Código CVV de la tarjeta (solo para método CARD)',
    required: false,
  })
  @IsOptional()
  @IsString()
  cvv?: string;

  @ApiProperty({
    example: true,
    description:
      'Indica si la tarjeta usada debe guardarse en el perfil del usuario',
    required: false,
  })
  @IsOptional()
  saveCard?: boolean;

  @ApiProperty({
    example: 5,
    description:
      'Identificador de una tarjeta previamente guardada para reutilizarla',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  existingCardId?: number;
}
