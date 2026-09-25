import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../../../auth/common/validators/password.decorator';

/**
 * Alta de un negocio desde la web (pública).
 *
 * Es lo mínimo para que el negocio pueda empezar a recibir reservas el
 * mismo día: quién es, dónde atiende y con qué cuenta entra. El resto
 * (logo, servicios, equipo) se completa ya dentro del panel.
 */
export class RegistroNegocioDto {
  /* ── El negocio ─────────────────────────────────────── */
  @ApiProperty({ example: 'Glow Experience' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  empresaNombre: string;

  @ApiProperty({ example: '+34600111222' })
  @IsString() @IsNotEmpty() @MaxLength(20)
  telefono: string;

  @ApiPropertyOptional({ example: 'Estetica', description: 'Tipo de negocio, para la descripción inicial.' })
  @IsOptional() @IsString() @MaxLength(60)
  rubro?: string;

  /* ── La primera sede ────────────────────────────────── */
  @ApiProperty({ example: 'Sede Centro' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  sedeNombre: string;

  @ApiProperty({ example: 'Calle Larios 5, Malaga' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  direccion: string;

  @ApiPropertyOptional() @IsOptional() @IsString() pais?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provincia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() municipio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() localidad?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() latitud?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() longitud?: number;

  /* ── Quien administra ───────────────────────────────── */
  @ApiProperty({ example: 'María' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'González' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'maria@glowexperience.es' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: PASSWORD_EXAMPLE, description: PASSWORD_RULES_MESSAGE })
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ example: 1, description: 'País del alta (1 = España).' })
  @IsOptional() @Type(() => Number) @IsInt()
  countryId?: number;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional() @IsString() @MaxLength(5)
  idioma?: string;

  /* ── Plan elegido ───────────────────────────────────── */
  @ApiProperty({
    example: 'pro',
    description:
      '"pro" arranca con los 30 días de prueba de Bookmy CRM Pro; "free" entra directo al plan gratuito.',
  })
  @IsIn(['free', 'pro'])
  plan: 'free' | 'pro';

  @ApiProperty({ example: true, description: 'Aceptación de términos y privacidad.' })
  @IsBoolean()
  acepta: boolean;
}
