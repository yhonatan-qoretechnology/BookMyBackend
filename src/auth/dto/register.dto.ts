import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum ClientType {
  people = 'people',
  business = 'business',
}

export enum ClientState {
  enabled = 'enabled',
  disabled = 'disabled',
  blocked = 'blocked',
}

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: '+348001112233',
    description: 'Phone number with country code',
  })
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'email@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Abc123@', description: 'Secure password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Masculino', description: 'Gender' })
  @IsNotEmpty()
  @IsString()
  gender: string;

  @ApiProperty({ example: 'es', description: 'Language' })
  @IsNotEmpty()
  @IsString()
  idioma: string;

  @ApiProperty({ example: 1, description: 'Country ID (foreign key)' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  countryId: number;

  @ApiProperty({ example: true, description: 'Accept terms and conditions' })
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' : value,
  )
  acceptTerms: boolean;

  @ApiProperty({ example: true, description: 'Accept privacy policy' })
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' : value,
  )
  acceptPolitics: boolean;

  @ApiProperty({
    example: 'people',
    enum: ClientType,
    description: 'Client type (person or business)',
  })
  @IsEnum(ClientType)
  clientType: ClientType;

  @ApiProperty({
    example: '1990-01-15',
    description: 'Date of birth of the user (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiProperty({
    example: 'enabled',
    enum: ClientState,
    description: 'User state (enabled, disabled, or blocked)',
  })
  @IsEnum(ClientState)
  state: ClientState;

  @ApiPropertyOptional({
    description: 'Archivo de la foto de perfil del usuario',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  fotoPerfil?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario a registrar',
    enum: Role,
    default: Role.CLIENT,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Nombre del administrador' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Apellido del administrador' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'ID de la empresa asociada' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  empresaId?: number;

  @ApiPropertyOptional({ description: 'ID de la sede asociada' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sedeId?: number;

  @ApiPropertyOptional({
    example: [1, 5, 10],
    description:
      'IDs de las categorías que el usuario selecciona durante el registro.',
    isArray: true,
    type: Number,
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v));
    }
    return undefined;
  })
  categoryIds?: number[];
}
