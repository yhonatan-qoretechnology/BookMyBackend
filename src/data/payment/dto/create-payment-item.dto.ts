import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Min, MaxLength } from 'class-validator';

/** Concepto adicional de una factura ("Recubrimiento en gel", 1, 5.00). */
export class CreatePaymentItemDto {
  @ApiProperty({ example: 'Recubrimiento en gel' })
  @IsString()
  @MaxLength(160)
  concepto: string;

  @ApiProperty({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  cantidad: number;

  @ApiProperty({ example: 5, description: 'Precio por unidad, en euros.' })
  @IsNumber()
  @Min(0)
  precioUnitario: number;
}
