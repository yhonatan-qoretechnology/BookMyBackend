import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { INSUMO_MAX_IMAGENES } from '../insumo-imagen.constants';

/** Cuerpo de DELETE /stock/insumos/:id/imagenes. */
export class QuitarImagenesInsumoDto {
  @ApiProperty({
    type: [String],
    example: ['https://bookmy.es/uploads/bookmy/insumos/14/foto.jpg'],
    description: 'Las fotos a quitar, tal cual están en `imagenes`.',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Indica al menos una foto para quitar.' })
  @ArrayMaxSize(INSUMO_MAX_IMAGENES)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imagenes: string[];

  @ApiPropertyOptional({
    example: 14,
    description: 'Solo SUPER_ADMIN: de qué negocio es.',
  })
  @IsOptional()
  @IsInt()
  empresaId?: number;
}
