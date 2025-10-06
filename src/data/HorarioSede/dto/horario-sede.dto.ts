import { ApiProperty } from '@nestjs/swagger';

export class HorarioSedeDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  sedeId: number;

  @ApiProperty({ example: 1 })
  diaSemana: number;

  @ApiProperty({ example: '08:00' })
  horaApertura: string;

  @ApiProperty({ example: '17:00' })
  horaCierre: string;

  @ApiProperty({ example: true })
  activo: boolean;
}
