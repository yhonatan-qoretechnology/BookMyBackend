import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateHorarioSedeDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la sede a la que pertenece el horario',
  })
  @IsInt()
  @Min(1)
  sedeId: number;

  @ApiProperty({
    example: 1,
    description: 'Día de la semana (0 = Domingo, 1 = Lunes, ... 6 = Sábado)',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @ApiProperty({
    example: '08:00',
    description: 'Hora de apertura en formato HH:mm (24 horas)',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Hora de apertura inválida',
  })
  horaApertura: string;

  @ApiProperty({
    example: '17:00',
    description: 'Hora de cierre en formato HH:mm (24 horas)',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Hora de cierre inválida',
  })
  horaCierre: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el horario está activo',
  })
  @IsBoolean()
  activo: boolean;
}
