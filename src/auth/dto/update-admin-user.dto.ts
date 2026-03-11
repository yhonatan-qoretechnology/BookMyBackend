import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClientState, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'María' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'González' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+34123456789' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'El teléfono debe tener entre 7 y 15 dígitos, opcionalmente con +',
  })
  phone?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Archivo de imagen para la foto de perfil (JPG/PNG/WebP)',
  })
  @IsOptional()
  photoFile?: Express.Multer.File;

  @ApiPropertyOptional({ enum: ClientState })
  @IsOptional()
  @IsEnum(ClientState)
  state?: ClientState;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  countryId?: number;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  idioma?: string;

  @ApiPropertyOptional({ example: 'no especificado' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsString()
  birthdate?: string;

  @ApiPropertyOptional({
    enum: [Role.COMPANY_ADMIN, Role.BRANCH_ADMIN],
    description: 'Rol del administrador',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
