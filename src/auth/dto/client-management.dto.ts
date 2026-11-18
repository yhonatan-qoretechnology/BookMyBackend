import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ClientState } from '@prisma/client';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';
import { ArrayMaxSize as ArrayMaxSizeFE, IsArray as IsArrayFE, IsIn as IsInFE, Max as MaxFE, Min as MinFE, ValidateNested as ValidateNestedFE } from 'class-validator';
import { Type as TypeFE } from 'class-transformer';

/** Un hijo del cliente (para campañas: cumpleaños infantiles, Día del Niño…). */
export class HijoDto {
  @ApiPropertyOptional({ example: 'Lucía' })
  @IsString()
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ example: '2018-04-12' })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiPropertyOptional({ example: 'female', enum: ['female', 'male', 'other'] })
  @IsOptional()
  @IsInFE(['female', 'male', 'other'])
  genero?: string;
}

/** Fechas especiales que puede celebrar un cliente (para campañas). */
export const FECHAS_ESPECIALES = ['NAVIDAD', 'ANO_NUEVO', 'SAN_VALENTIN', 'AMOR_AMISTAD', 'DIA_MUJER', 'DIA_MADRE', 'DIA_PADRE', 'DIA_NINO', 'HALLOWEEN', 'BLACK_FRIDAY', 'VUELTA_COLE', 'ANIVERSARIO'];


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

  @ApiPropertyOptional({ example: 2, description: 'Número de hijos' })
  @IsOptional()
  @TypeFE(() => Number)
  @IsInt()
  @MinFE(0)
  @MaxFE(20)
  hijos?: number;

  @ApiPropertyOptional({ example: ['NAVIDAD', 'DIA_MADRE'], description: 'Fechas especiales que celebra' })
  @IsOptional()
  @IsArrayFE()
  @IsInFE(FECHAS_ESPECIALES, { each: true })
  fechasEspeciales?: string[];

  @ApiPropertyOptional({ type: [HijoDto], description: 'Datos de cada hijo' })
  @IsOptional()
  @IsArrayFE()
  @ArrayMaxSizeFE(20)
  @ValidateNestedFE({ each: true })
  @TypeFE(() => HijoDto)
  hijosDetalle?: HijoDto[];


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

/**
 * Alta manual de un cliente final desde el panel (POST /clients).
 * Distinto de POST /auth/register, que es público y no sabe qué admin
 * llama: acá el cliente queda vinculado al negocio del admin
 * (ClienteEmpresa) y aparece en su listado sin esperar a su primera cita.
 */
export class CreateClientDto {
  @ApiProperty({ example: 'Lucía Pérez' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'lucia@correo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+34600111222' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: PASSWORD_EXAMPLE, description: PASSWORD_RULES_MESSAGE })
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ example: 'Femenino' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ example: 'es' })
  @IsNotEmpty()
  @IsString()
  idioma: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  countryId: number;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({ example: 2, description: 'Número de hijos' })
  @IsOptional()
  @TypeFE(() => Number)
  @IsInt()
  @MinFE(0)
  @MaxFE(20)
  hijos?: number;

  @ApiPropertyOptional({ example: ['NAVIDAD', 'DIA_MADRE'], description: 'Fechas especiales que celebra' })
  @IsOptional()
  @IsArrayFE()
  @IsInFE(FECHAS_ESPECIALES, { each: true })
  fechasEspeciales?: string[];

  @ApiPropertyOptional({ type: [HijoDto], description: 'Datos de cada hijo' })
  @IsOptional()
  @IsArrayFE()
  @ArrayMaxSizeFE(20)
  @ValidateNestedFE({ each: true })
  @TypeFE(() => HijoDto)
  hijosDetalle?: HijoDto[];

  @ApiPropertyOptional({
    description: 'Solo SUPER_ADMIN: negocio al que se vincula. Los demás usan el suyo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  empresaId?: number;
}
