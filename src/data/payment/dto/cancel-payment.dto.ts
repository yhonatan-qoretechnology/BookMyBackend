import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class CancelPaymentDto {
  @ApiProperty({ example: 1, description: 'ID del pago a cancelar' })
  @IsNumber()
  @IsNotEmpty()
  paymentId: number;
}
