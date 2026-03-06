import { ApiProperty } from '@nestjs/swagger';

export class PaymentCardResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 45 })
  userId: number;

  @ApiProperty({ example: 'visa' })
  brand: string;

  @ApiProperty({ example: '4242' })
  last4: string;

  @ApiProperty({ example: 10 })
  expiryMonth: number;

  @ApiProperty({ example: 2028 })
  expiryYear: number;

  @ApiProperty({ example: 'María Gómez' })
  cardholderName: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '7b45ae06-2c80-4c37-a469-19d4a0e4efd2' })
  token?: string;

  @ApiProperty({ example: '2026-01-18T13:45:22.123Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-18T13:45:22.123Z' })
  updatedAt: Date;
}
