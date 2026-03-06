import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsInt } from 'class-validator';

export class SearchClientDto {
  @ApiProperty({ example: 'cliente@email.com', description: 'Email del cliente' })
  @IsEmail()
  email: string;
}

export class ClientListDto {
  @ApiPropertyOptional({ example: 'cliente@email.com', description: 'Filtrar por email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 123, description: 'Filtrar por ID' })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({ example: 'Juan', description: 'Filtrar por nombre' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Número de página' })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Resultados por página' })
  @IsOptional()
  @IsInt()
  limit?: number = 20;
}

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Juan Pérez', description: 'Nombre completo' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+34123456789', description: 'Teléfono' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'es', description: 'Idioma' })
  @IsOptional()
  @IsString()
  idioma?: string;

  @ApiPropertyOptional({ example: 'masculino', description: 'Género' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '1990-01-15', description: 'Fecha de nacimiento' })
  @IsOptional()
  @IsString()
  birthdate?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID del país' })
  @IsOptional()
  @IsInt()
  countryId?: number;
}
