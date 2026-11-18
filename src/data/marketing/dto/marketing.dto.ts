import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Criterios de un filtro de clientes. Todos opcionales: los que vienen se
 * combinan con Y (el cliente tiene que cumplir todos).
 */
export class CriteriosFiltroDto {
  @ApiPropertyOptional({ description: 'Solo clientes de esta sede' })
  @IsOptional() @IsInt()
  sedeId?: number;

  @ApiPropertyOptional({ example: 'female', description: 'Género tal como lo guarda el perfil' })
  @IsOptional() @IsString() @MaxLength(30)
  genero?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional() @IsInt() @Min(0) @Max(120)
  edadMin?: number;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional() @IsInt() @Min(0) @Max(120)
  edadMax?: number;

  @ApiPropertyOptional({ example: 3, description: 'Mes de cumpleaños (1-12); 0 = el mes en curso' })
  @IsOptional() @IsInt() @Min(0) @Max(12)
  cumpleMes?: number;

  @ApiPropertyOptional({ description: 'Cumplen años hoy' })
  @IsOptional() @IsBoolean()
  cumpleHoy?: boolean;

  @ApiPropertyOptional({ example: 'Madrid' })
  @IsOptional() @IsString() @MaxLength(120)
  ciudad?: string;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional() @IsString() @MaxLength(50)
  idioma?: string;

  @ApiPropertyOptional({ example: 2, description: 'Mínimo de reservas en el negocio' })
  @IsOptional() @IsInt() @Min(0) @Max(10000)
  reservasMin?: number;

  @ApiPropertyOptional({ example: 60, description: 'Sin venir hace más de X días (inactivos)' })
  @IsOptional() @IsInt() @Min(1) @Max(3650)
  sinVisitaDias?: number;

  @ApiPropertyOptional({ example: 30, description: 'Vinieron en los últimos X días' })
  @IsOptional() @IsInt() @Min(1) @Max(3650)
  visitaRecienteDias?: number;

  @ApiPropertyOptional({ description: 'Han reservado este servicio' })
  @IsOptional() @IsInt()
  servicioId?: number;

  @ApiPropertyOptional({ description: 'true = con hijos; false = sin hijos' })
  @IsOptional() @IsBoolean()
  conHijos?: boolean;

  @ApiPropertyOptional({ example: 'DIA_MADRE', description: 'Celebra esta fecha especial' })
  @IsOptional() @IsString() @MaxLength(30)
  fechaEspecial?: string;

  @ApiPropertyOptional({ example: 30, description: 'Clientes nuevos: se unieron en los últimos X días' })
  @IsOptional() @IsInt() @Min(1) @Max(3650)
  nuevosDias?: number;
}

export class GuardarFiltroDto {
  @ApiPropertyOptional({ description: 'Obligatorio para el superadmin' })
  @IsOptional() @IsInt()
  empresaId?: number;

  @ApiProperty({ example: 'Clientas VIP de Madrid' })
  @IsString() @MinLength(2) @MaxLength(120)
  nombre: string;

  @ApiProperty({ type: CriteriosFiltroDto })
  @ValidateNested() @Type(() => CriteriosFiltroDto)
  criterios: CriteriosFiltroDto;
}

export class VistaPreviaFiltroDto {
  @ApiPropertyOptional()
  @IsOptional() @IsInt()
  empresaId?: number;

  @ApiProperty({ type: CriteriosFiltroDto })
  @ValidateNested() @Type(() => CriteriosFiltroDto)
  criterios: CriteriosFiltroDto;
}

export class GuardarCampanaDto {
  @ApiPropertyOptional()
  @IsOptional() @IsInt()
  empresaId?: number;

  @ApiProperty({ description: 'Filtro guardado al que va la campaña' })
  @IsInt()
  filtroId: number;

  @ApiProperty({ example: 'Promo manicura' })
  @IsString() @MinLength(2) @MaxLength(120)
  nombre: string;

  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  canal: 'EMAIL' | 'WHATSAPP';

  @ApiPropertyOptional({ example: '20 % en manicura esta semana' })
  @IsOptional() @IsString() @MaxLength(200)
  asunto?: string;

  @ApiProperty({ example: '¡Hola {{nombre}}! Esta semana tienes 20 % en {{negocio}}. Reserva aquí: {{enlace_reserva}}' })
  @IsString() @MinLength(5) @MaxLength(1000)
  mensaje: string;

  @ApiPropertyOptional({ description: 'Hasta 2 imágenes como data URL (JPG, PNG o WEBP; máx. 100 KB cada una)' })
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsString({ each: true })
  imagenes?: string[];

  @ApiPropertyOptional({ description: 'Enviar en esta fecha; sin ella se envía al momento' })
  @IsOptional() @IsDateString()
  programadaPara?: string;

  @ApiPropertyOptional({ description: 'Guardar como borrador sin enviar' })
  @IsOptional() @IsBoolean()
  borrador?: boolean;
}
