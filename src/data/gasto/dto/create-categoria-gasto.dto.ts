import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateCategoriaGastoDto {
  @ApiProperty({
    example: 'Mantenimiento',
    description: 'Nombre de la categoría de gasto',
  })
  @IsString()
  @MaxLength(80)
  nombre: string;
}
