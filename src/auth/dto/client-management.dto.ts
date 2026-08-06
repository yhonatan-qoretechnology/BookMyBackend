import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ClientState } from '@prisma/client';

export class SearchClientDto {
  @ApiProperty({ example: 'cliente@email.com', description: 'Email del cliente' })
  @IsEmail()
  email: string;
}

/**
 * Filtros de GET /clients.
 *
 * Los parámetros numéricos llegan como texto en la query string, así que
 * necesitan @Type(() => Number) para que el ValidationPipe los convierta
 * antes de validarlos. Sin esto, cualquier petición con `page`, `limit`
 * o `id` respondía 400 ("limit must be an integer number") y la
 * paginación resultaba inservible.
 */
export class ClientListDto {
  @ApiPropertyOptional({ example: 'cliente@email.com', description: 'Filtrar por email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 123, description: 'Filtrar por ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @ApiPropertyOptional({ example: 'Juan', description: 'Filtrar por nombre' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Número de página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Resultados por página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
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

  /**
   * El correo es la identidad de acceso: se replica en `users`,
   * `user_auth` y `user_data`, así que el servicio lo actualiza en
   * las tres tablas dentro de una misma transacción.
   */
  @ApiPropertyOptional({ example: 'cliente@email.com', description: 'Correo (también es el usuario de acceso)' })
  @IsOptional()
  @IsEmail()
  email?: string;

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

  @ApiPropertyOptional({ example: 'Calle Mayor 1', description: 'Dirección' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID del país' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  countryId?: number;

  @ApiPropertyOptional({
    enum: ClientState,
    example: 'enabled',
    description: 'Estado de la cuenta; solo `enabled` puede iniciar sesión',
  })
  @IsOptional()
  @IsEnum(ClientState)
  state?: ClientState;
}

/** Nueva contraseña fijada por un administrador (no pide la anterior). */
export class ChangeClientPasswordDto {
  @ApiProperty({ example: 'Abc123@', description: 'Nueva contraseña (mínimo 6 caracteres)' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
