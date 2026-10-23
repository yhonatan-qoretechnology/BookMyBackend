import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/** Monedas que se pueden elegir para un adicional ("Otros") que se cobró
    en una moneda distinta a la del negocio — ver PaymentItem.moneda. */
export const MONEDAS_ADICIONAL = ['EUR', 'USD'] as const;

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

  @ApiPropertyOptional({
    enum: MONEDAS_ADICIONAL,
    example: 'EUR',
    description:
      'Solo si este adicional se cobró en una moneda distinta a la del negocio. Sin ella, se asume la moneda de la factura.',
  })
  @IsOptional()
  @IsIn(MONEDAS_ADICIONAL)
  moneda?: string;
}
