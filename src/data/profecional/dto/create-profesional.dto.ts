import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProfesionalDto {
  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre completo del profesional',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: 'Especialista en cortes modernos y tratamientos capilares.',
    description: 'Biografía o descripción del profesional',
    required: false,
  })
  @IsOptional()
  @IsString()
  biografia?: string;

  @ApiProperty({
    example: '+34666555444',
    description: 'Número de teléfono del profesional',
  })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({
    type: 'number',
    example: 1,
    description: 'ID de la sede a la que pertenece el profesional',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  sedeId: number;
}
