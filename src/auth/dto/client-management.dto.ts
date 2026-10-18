import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ClientState } from '@prisma/client';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';

/**
 * Busqueda EXACTA de un cliente, para traer al negocio a alguien que
 * todavia no ha reservado con el.
 *
 * Es exacta a proposito: el listado solo ensena los clientes del propio
 * negocio, asi que esto es la unica via de llegar a uno de fuera. Si
 * admitiera busquedas parciales, cualquier administrador podria recorrer
 * la cartera de los demas escribiendo "@gmail" y mirando lo que sale.
 * Haciendo falta el correo, el telefono o el documento COMPLETOS, solo
 * encuentra a quien ya tienes delante dandotelos.
 */
export class SearchClientDto {
  @ApiPropertyOptional({ example: 'cliente@email.com', description: 'Correo completo' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+34600111222', description: 'Teléfono completo' })
  @IsOptional()
  @IsString()
  telefono?: string;

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

  @ApiPropertyOptional({
    example: 7,
    description:
      'Acotar a los clientes de una empresa. Lo usa el SUPER_ADMIN cuando crea una ' +
      'reserva en nombre de un negocio: sin esto veria los clientes de toda la ' +
      'plataforma en el paso de elegir cliente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  empresaId?: number;

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
  @ApiProperty({
    example: PASSWORD_EXAMPLE,
    description: `Nueva contraseña. ${PASSWORD_RULES_MESSAGE}`,
  })
  @IsStrongPassword()
  password: string;
}
