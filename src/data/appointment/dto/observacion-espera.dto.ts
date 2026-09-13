import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Nota sobre el cliente que espera a ser atendido. */
export class ObservacionEsperaDto {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Llego 10 min antes; espera a que termine la clienta anterior',
    description: 'Texto libre. Enviar null o cadena vacia para borrarla.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionEspera?: string | null;
}
