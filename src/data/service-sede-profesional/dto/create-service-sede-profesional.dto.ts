import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class CreateServiceSedeProfesionalDto {
  @ApiProperty({
    example: 1,
    description: 'ID del servicio',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  serviceId: number;

  @ApiProperty({
    example: 1,
    description: 'ID de la sede',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  sedeId: number;

  @ApiProperty({
    example: 1,
    description: 'ID del profesional',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  profesionalId: number;

  @ApiProperty({
    example: 10,
    required: false,
    description:
      'Minutos de bloqueo automático tras cada cita de este servicio en esta sede (limpieza, preparación). Por defecto 0.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  tiempoAdicionalMinutos?: number;

  @ApiProperty({
    example: false,
    required: false,
    description:
      'Si no alcanza el tiempo antes del cierre, permite partir el servicio en dos citas enlazadas (hoy + el resto el próximo día disponible del mismo profesional) en vez de rechazar la reserva. Por defecto false.',
  })
  @IsOptional()
  @IsBoolean()
  permiteContinuarOtroDia?: boolean;
}
