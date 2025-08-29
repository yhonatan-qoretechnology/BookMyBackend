import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSedeDto {
  @ApiProperty({ example: 'Sede Principal', description: 'Nombre de la sede' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: 'Calle 10 # 5-20',
    description: 'Dirección de la sede',
  })
  @IsNotEmpty()
  @IsString()
  direccion: string;

  @ApiProperty({
    example: '+348001112233',
    description: 'Número de teléfono de la sede',
    required: false,
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    example: 39.85775568894994,
    description: 'Latitud de la sede',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitud?: number;

  @ApiProperty({
    example: -4.020722145741523,
    description: 'Longitud de la sede',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitud?: number;

  @ApiProperty({
    example: 'Antioquia',
    description: 'Provincia o departamento de la sede',
    required: false,
  })
  @IsOptional()
  @IsString()
  provincia?: string;

  @ApiProperty({
    type: 'number',
    example: 2,
    description: 'ID de la empresa a la que pertenece la sede',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  empresaId: number;
}
