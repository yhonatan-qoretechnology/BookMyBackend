import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientState, ClientType, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'admin@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123$' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '+34123456789' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'González' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'María González' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  countryId: number;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  idioma?: string;

  @ApiPropertyOptional({ example: 'femenino' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsString()
  birthdate?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Archivo de imagen para la foto de perfil (JPG/PNG/WebP)',
  })
  @IsOptional()
  photoFile?: Express.Multer.File;

  @ApiPropertyOptional({
    enum: [Role.COMPANY_ADMIN, Role.BRANCH_ADMIN, Role.EMPLOYEE],
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  empresaId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sedeId?: number;

  @ApiPropertyOptional({ enum: ClientType, default: ClientType.business })
  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @ApiPropertyOptional({ enum: ClientState, default: ClientState.enabled })
  @IsOptional()
  @IsEnum(ClientState)
  state?: ClientState;
}
