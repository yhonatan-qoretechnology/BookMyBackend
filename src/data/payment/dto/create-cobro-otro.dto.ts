import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Cobro de algo que no está en el catálogo («Otro servicio»): se escribe el
 * concepto y el precio a mano. POST /payments/otro.
 */
export class CreateCobroOtroDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  sedeId: number;

  @ApiProperty({ example: 120, description: 'Cliente (userId)' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  profesionalId: number;

  @ApiProperty({ example: 'Arreglo de uñas rotas' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  concepto: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0.01)
  @Max(100000000)
  precio: number;

  @ApiProperty({ example: '2026-11-14' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha: string;

  @ApiProperty({ example: '10:30' })
  @Matches(/^\d{2}:\d{2}$/)
  hora: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  duracion?: number;

  @ApiProperty({ enum: ['CASH', 'CARD'] })
  @IsIn(['CASH', 'CARD'])
  metodo: 'CASH' | 'CARD';
}
