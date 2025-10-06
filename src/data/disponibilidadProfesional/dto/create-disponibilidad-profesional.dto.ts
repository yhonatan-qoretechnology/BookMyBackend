import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateDisponibilidadProfesionalDto {
  @ApiProperty({ example: 1, description: 'ID del profesional' })
  @IsInt()
  @Min(1)
  profesionalId: number;

  @ApiProperty({
    example: '2025-10-10',
    description: 'Fecha para la disponibilidad (YYYY-MM-DD)',
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    example: true,
    description: 'Si el profesional está disponible ese día',
  })
  @IsBoolean()
  disponible: boolean;

  @ApiProperty({
    example: '09:00',
    description:
      'Hora inicio (opcional si disponible es true y aplica solo a tramo)',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaInicio inválida (HH:mm)',
  })
  horaInicio?: string;

  @ApiProperty({
    example: '13:00',
    description:
      'Hora fin (opcional si disponible es true y aplica solo a tramo)',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaFin inválida (HH:mm)',
  })
  horaFin?: string;

  @ApiProperty({
    example: 'Vacaciones',
    description: 'Motivo (opcional): vacaciones, licencia, etc.',
    required: false,
  })
  @IsOptional()
  @IsString()
  motivo?: string;
}
