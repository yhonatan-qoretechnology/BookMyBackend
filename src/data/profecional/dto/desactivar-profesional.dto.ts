import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const MOTIVOS_INACTIVO = ['INCAPACIDAD', 'VACACIONES', 'RETIRO', 'OTRO'] as const;

/** PATCH /profesionales/:id/desactivar (multipart, «soporte» opcional). */
export class DesactivarProfesionalDto {
  @ApiProperty({ enum: MOTIVOS_INACTIVO })
  @IsIn(MOTIVOS_INACTIVO as unknown as string[])
  motivo: (typeof MOTIVOS_INACTIVO)[number];

  @ApiProperty({ example: 'Incapacidad médica de 5 días' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  comentario: string;
}
