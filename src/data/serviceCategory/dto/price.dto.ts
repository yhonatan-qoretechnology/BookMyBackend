import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

/*
   El tope de precio NO vive aqui. Un corte de pelo son 18 EUR en Espana y
   unos 45.000 COP en Colombia: un `@Max(1000)` fijo rechazaba cualquier
   precio colombiano real, y encima con un mensaje en euros. El minimo y el
   maximo salen de `country` (precioMinimo / precioMaximo) y los valida
   ServiceService, que es donde si se sabe de que pais es el negocio.
*/

export class PriceDto {
  @ApiProperty({
    example: 25.5,
    description:
      'Precio del servicio, en la moneda del país del negocio. Los límites los fija ese país.',
  })
  @IsNumber()
  @IsPositive({ message: 'El precio tiene que ser mayor que cero' })
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
    description:
      'Moneda en ISO 4217. Normalmente no se manda: se toma la del país del negocio.',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class UpdatePriceDto {
  @ApiPropertyOptional({
    example: 30.0,
    description: 'Precio del servicio, en la moneda del país del negocio.',
  })
  @IsNumber()
  @IsPositive({ message: 'El precio tiene que ser mayor que cero' })
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
    description: 'Moneda en ISO 4217. Por defecto, la del país del negocio.',
  })
  @IsString()
  @IsOptional()
  currency?: string;
}
