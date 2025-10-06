import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({
    example: '2025-10-07T00:00:00Z',
    description: 'Fecha de la cita',
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    example: '2025-10-07T09:00:00Z',
    description: 'Hora de inicio de la cita',
  })
  @IsDateString()
  horaInicio: string;

  @ApiProperty({
    example: '2025-10-07T09:30:00Z',
    description: 'Hora de fin de la cita',
  })
  @IsDateString()
  horaFin: string;

  @ApiProperty({ example: 30, description: 'Duración del servicio en minutos' })
  @IsInt()
  duracion: number;

  @ApiProperty({ enum: AppointmentStatus, example: AppointmentStatus.PENDING })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  estado?: AppointmentStatus;

  @ApiProperty({
    example: 'Cliente solicita atención urgente',
    required: false,
  })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiProperty({ example: 1, description: 'ID de la sede' })
  @IsInt()
  sedeId: number;

  @ApiProperty({ example: 2, description: 'ID del servicio' })
  @IsInt()
  serviceId: number;

  @ApiProperty({ example: 3, description: 'ID del profesional asignado' })
  @IsInt()
  profesionalId: number;

  @ApiProperty({
    example: 5,
    description: 'ID del usuario que solicita la cita',
  })
  @IsInt()
  userId: number;
}
