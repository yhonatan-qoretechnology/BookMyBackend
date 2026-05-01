import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'Nueva fecha de la cita (YYYY-MM-DD)',
    type: 'string',
    format: 'date',
    example: '2026-05-15',
  })
  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @ApiProperty({
    description: 'Nueva hora de inicio (HH:mm:ss)',
    type: 'string',
    format: 'time',
    example: '10:00:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'horaInicio debe tener formato HH:mm:ss',
  })
  @IsNotEmpty()
  horaInicio: string;

  @ApiProperty({
    description: 'Nueva hora de fin (HH:mm:ss)',
    required: false,
    type: 'string',
    format: 'time',
    example: '11:00:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'horaFin debe tener formato HH:mm:ss',
  })
  @IsOptional()
  horaFin?: string;

  @ApiProperty({ description: 'Motivo del reagendamiento', required: false })
  @IsOptional()
  motivo?: string;
}
