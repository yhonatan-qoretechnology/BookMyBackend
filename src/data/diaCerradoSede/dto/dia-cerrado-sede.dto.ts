import { ApiProperty } from '@nestjs/swagger';

export class DiaCerradoSedeDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  sedeId: number;

  @ApiProperty({ example: '2025-12-25' })
  fecha: string;

  @ApiProperty({ example: 'Navidad' })
  motivo?: string;

  @ApiProperty({ example: true })
  todoElDia: boolean;

  @ApiProperty({ example: '09:00' })
  horaInicio?: string;

  @ApiProperty({ example: '13:00' })
  horaFin?: string;
}
