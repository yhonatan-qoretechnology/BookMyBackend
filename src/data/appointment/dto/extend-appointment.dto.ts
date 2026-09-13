import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Alargar una cita sin moverla de hora.
 *
 * Va aparte de RescheduleAppointmentDto porque reschedule EXIGE que la
 * duracion no cambie ("La duracion debe coincidir con la cita original") y
 * ademas machaca `notas` con el texto "Reagendado...", lo que borraria la
 * nota del cliente.
 */
export class ExtendAppointmentDto {
  @ApiProperty({
    example: 90,
    description:
      'Nueva duracion TOTAL de la cita en minutos (no los minutos que se anaden). Debe ser mayor que la actual.',
  })
  @IsInt()
  @Min(1)
  duracion: number;

  @ApiProperty({
    required: false,
    example: 'La clienta pidio refuerzo de fibra',
    description: 'Motivo de la ampliacion. Se guarda en observacionEspera, no en notas.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
