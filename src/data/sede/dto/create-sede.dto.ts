import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
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
    example: {
      lunes: '10:00-19:00',
      martes: '10:00-19:00',
      Miércoles: '10:00-19:00',
      Jueves: '10:00-19:00',
      Viernes: '10:00-19:00',
      Sábado: '10:00-14:00',
      Domingo: 'Cerrado',
    },
    description: 'Horario de apertura y cierre en formato de objeto JSON',
    required: false,
  })
  @IsOptional()
  @IsObject() // ✅ Ahora valida que sea un objeto
  horario?: object;

  @ApiProperty({
    example: ['2025-08-31', '2026-09-07', '2026-09-14', '2026-09-21'],
    description: 'Días que la sede estará cerrada en formato de array JSON',
    required: false,
  })
  @IsOptional()
  @IsArray() // ✅ Ahora valida que sea un array
  @IsString({ each: true }) // ✅ Asegura que cada elemento del array sea una cadena
  diasCerrado?: string[];

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
