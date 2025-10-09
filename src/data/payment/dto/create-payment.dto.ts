import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
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
    example: '4242424242424242',
    description: 'Número de tarjeta (solo para método CARD)',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiProperty({
    example: '12/26',
    description: 'Fecha de expiración de la tarjeta (solo para método CARD)',
    required: false,
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiProperty({
    example: '123',
    description: 'Código CVV de la tarjeta (solo para método CARD)',
    required: false,
  })
  @IsOptional()
  @IsString()
  cvv?: string;
}
