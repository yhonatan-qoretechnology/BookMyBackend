import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ClientState, ClientType } from './register.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Tipo de cliente' })
  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @ApiPropertyOptional({ description: 'Estado del usuario' })
  @IsOptional()
  @IsEnum(ClientState)
  state?: ClientState;

  @ApiPropertyOptional({ description: 'Acepta términos y condiciones' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' : value,
  )
  acceptTerms?: boolean;

  @ApiPropertyOptional({ description: 'Acepta políticas de privacidad' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' : value,
  )
  acceptPolitics?: boolean;

  @ApiPropertyOptional({ description: 'Nombre del usuario' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: 'Teléfono del usuario' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Dirección del usuario' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ description: 'Idioma preferido' })
  @IsOptional()
  @IsString()
  idioma?: string;

  @ApiPropertyOptional({ description: 'Género' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({ description: 'ID del país asociado' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  countryId?: number;

  @ApiPropertyOptional({
    description: 'IDs de categorías seleccionadas',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
        }
      } catch (error) {
        return value
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => !Number.isNaN(v));
      }
      return value
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v));
    }
    return undefined;
  })
  categoryIds?: number[];
}
