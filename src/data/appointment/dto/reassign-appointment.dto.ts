import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ReassignAppointmentDto {
  @ApiProperty({
    example: 7,
    description:
      'ID del nuevo profesional que atenderá esta cita (debe ofrecer el mismo servicio en la misma sede y estar libre en ese horario).',
  })
  @IsInt()
  nuevoProfesionalId: number;

  @ApiProperty({
    example: 'La cita anterior de este profesional se extendió',
    required: false,
  })
  @IsOptional()
  @IsString()
  motivo?: string;
}
