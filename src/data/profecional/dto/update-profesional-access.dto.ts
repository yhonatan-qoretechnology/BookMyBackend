import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfesionalAccessDto {
  @ApiPropertyOptional({
    example: 'nuevo.email@empresa.com',
    description: 'Nuevo email de acceso del profesional.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'NuevaPass123@',
    description: 'Nueva contraseña de acceso del profesional.',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
