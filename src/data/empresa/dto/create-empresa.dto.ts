import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEmpresaDto {
  @ApiProperty({
    example: 'Barbería La Clave',
    description: 'Nombre de la empresa',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: '573123456789',
    description: 'Número de teléfono',
    required: false,
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    example: 'contacto@barberialaclave.com',
    description: 'Correo electrónico',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '900123456-7',
    description: 'Número de identificación tributaria (NIT)',
    required: false,
  })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({
    example: 'Especialistas en cortes y cuidado de barba.',
    description: 'Descripción',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
