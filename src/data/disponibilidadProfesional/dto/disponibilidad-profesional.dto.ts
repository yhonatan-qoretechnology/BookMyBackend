import { ApiProperty } from '@nestjs/swagger';

export class DisponibilidadProfesionalDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  profesionalId: number;

  @ApiProperty({ example: '2025-10-10' })
  fecha: string;

  @ApiProperty({ example: true })
  disponible: boolean;

  @ApiProperty({ example: '09:00', required: false })
  horaInicio?: string;

  @ApiProperty({ example: '13:00', required: false })
  horaFin?: string;

  @ApiProperty({ example: 'Vacaciones', required: false })
  motivo?: string;
}
