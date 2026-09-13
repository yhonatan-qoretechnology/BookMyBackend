import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExtendAppointmentDto {
  @ApiProperty({
    example: 15,
    description:
      'Minutos adicionales que necesita la cita en curso (el profesional no terminó a tiempo).',
  })
  @IsInt()
  @Min(1)
  @Max(240)
  extraMinutes: number;

  @ApiProperty({
    example: 'El cliente pidió un servicio adicional durante la cita',
    required: false,
  })
  @IsOptional()
  @IsString()
  motivo?: string;
}
