import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGastoDto {
  @ApiProperty({
    example: 'Compra de insumos',
    description: 'Descripción corta del gasto',
  })
  @IsString()
  @MaxLength(160)
  descripcion: string;

  @ApiProperty({ example: 45000, description: 'Monto total del gasto' })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({
    example: '2026-07-30',
    description: 'Fecha en que se realizó el gasto',
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({ example: 3, description: 'ID de la categoría del gasto' })
  @IsInt()
  categoriaId: number;

  @ApiProperty({
    example: 5,
    description: 'ID de la sede donde se registra el gasto',
  })
  @IsInt()
  sedeId: number;

  @ApiPropertyOptional({
    example: '/uploads/gastos/ticket.jpg',
    description: 'URL del comprobante subido (ver POST /gastos/upload)',
  })
  @IsOptional()
  @IsString()
  ticketUrl?: string;
}
