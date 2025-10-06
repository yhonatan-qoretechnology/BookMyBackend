import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateCitaDto {
  @ApiProperty({
    description: 'ID de la sede donde se agenda la cita.',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  sedeId: number;

  @ApiProperty({
    description: 'ID del servicio que se va a realizar.',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  serviceId: number;

  @ApiProperty({
    description: 'ID del profesional que atenderá la cita.',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  profesionalId: number;

  @ApiProperty({
    description: 'Fecha de la cita en formato ISO 8601 (yyyy-mm-dd).',
    example: '2025-09-20',
  })
  @IsNotEmpty()
  @IsString()
  fecha: string;

  @ApiProperty({
    description: 'Hora de inicio de la cita en formato HH:mm.',
    example: '15:30',
  })
  @IsNotEmpty()
  @IsString()
  hora: string;

  @ApiProperty({
    description: 'ID del Usuario que tomo la cita.',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  usuarioId: number;
}
