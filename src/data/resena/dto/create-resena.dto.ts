import { ApiProperty } from '@nestjs/swagger';
import { ResenaState, ResenaType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateResenaDto {
  @ApiProperty({
    example: 4.5,
    description: 'Calificación de la reseña, del 1 al 5',
  })
  @IsNotEmpty()
  @IsNumber()
  calificacion: number;

  @ApiProperty({
    example: 'Excelente servicio, muy recomendado.',
    description: 'Comentario opcional sobre la reseña',
    required: false,
  })
  @IsOptional()
  @IsString()
  comentario?: string;

  @ApiProperty({
    enum: ResenaState,
    example: ResenaState.PENDIENTE,
    description: 'Estado de la reseña',
  })
  @IsNotEmpty()
  @IsEnum(ResenaState)
  estado: ResenaState;

  @ApiProperty({
    enum: ResenaType,
    example: ResenaType.SERVICIO,
    description: 'Tipo de reseña, si es para una sede o un servicio',
  })
  @IsNotEmpty()
  @IsEnum(ResenaType)
  tipo: ResenaType;

  @ApiProperty({
    example: 1,
    description: 'ID de la sede a la que pertenece la reseña',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sedeId?: number;

  @ApiProperty({
    example: 1,
    description: 'ID del usuario que crea la reseña',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  usuarioId: number;
}
