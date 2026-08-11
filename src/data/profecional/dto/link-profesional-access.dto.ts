import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LinkProfesionalAccessDto {
  @ApiProperty({
    example: 'juan.perez@empresa.com',
    description: 'Email real del profesional, usado para iniciar sesión.',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Abc123@',
    description: 'Contraseña de acceso del profesional.',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
