import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AccionAutomatizacion, DestinoAutomatizacion, SegmentoCampana } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearAutomatizacionDto {
  @ApiProperty({ example: 'Bienvenida a negocios nuevos' })
  @IsNotEmpty() @IsString() @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  descripcion?: string;

  @ApiProperty({ example: 'empresa.registrada', description: 'Ver GET /automatizaciones/eventos' })
  @IsNotEmpty() @IsString() @MaxLength(80)
  evento: string;

  @ApiPropertyOptional({ example: 60, description: 'Minutos de espera tras el evento (máx. 30 días)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(43_200)
  retrasoMinutos?: number;

  @ApiPropertyOptional({ enum: AccionAutomatizacion })
  @IsOptional() @IsEnum(AccionAutomatizacion)
  accion?: AccionAutomatizacion;

  @ApiPropertyOptional({ enum: DestinoAutomatizacion })
  @IsOptional() @IsEnum(DestinoAutomatizacion)
  destino?: DestinoAutomatizacion;

  @ApiProperty({ example: '¡Bienvenido a Bookmy, {{empresa}}!' })
  @IsNotEmpty() @IsString() @MaxLength(200)
  asunto: string;

  @ApiProperty({ example: 'Hola {{empresa}}, gracias por unirte…' })
  @IsNotEmpty() @IsString() @MaxLength(5000)
  mensaje: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  activa?: boolean;
}

export class ActualizarAutomatizacionDto extends PartialType(CrearAutomatizacionDto) {}

export class CrearCampanaDto {
  @ApiProperty({ example: 'Novedades de noviembre' })
  @IsNotEmpty() @IsString() @MaxLength(120)
  nombre: string;

  @ApiProperty()
  @IsNotEmpty() @IsString() @MaxLength(200)
  asunto: string;

  @ApiProperty()
  @IsNotEmpty() @IsString() @MaxLength(10000)
  mensaje: string;

  @ApiPropertyOptional({ enum: SegmentoCampana })
  @IsOptional() @IsEnum(SegmentoCampana)
  segmento?: SegmentoCampana;

  @ApiPropertyOptional({ description: 'Fecha y hora de envío (ISO). Sin ella queda en borrador.' })
  @IsOptional() @IsDateString()
  programadaPara?: string;
}

export class ActualizarCampanaDto extends PartialType(CrearCampanaDto) {}
