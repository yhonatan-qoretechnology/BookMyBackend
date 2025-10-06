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

export class CreateDiaCerradoSedeDto {
  @ApiProperty({ example: 1, description: 'ID de la sede asociada' })
  @IsInt()
  @Min(1)
  sedeId: number;

  @ApiProperty({
    example: '2025-12-25',
    description: 'Fecha del día cerrado en formato ISO (YYYY-MM-DD)',
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    example: 'Navidad',
    description: 'Motivo del cierre (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el cierre aplica todo el día',
  })
  @IsBoolean()
  todoElDia: boolean;

  @ApiProperty({
    example: '09:00',
    description: 'Hora de inicio (si no es todo el día)',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Hora de inicio inválida (formato HH:mm)',
  })
  horaInicio?: string;

  @ApiProperty({
    example: '13:00',
    description: 'Hora de fin (si no es todo el día)',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Hora de fin inválida (formato HH:mm)',
  })
  horaFin?: string;
}
