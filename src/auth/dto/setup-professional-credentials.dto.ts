import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, MinLength } from 'class-validator';

export class SetupProfessionalCredentialsDto {
  @ApiProperty({
    example: 'juan@example.com',
    description: 'Email para las credenciales del profesional',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'MiContraseña123!',
    description: 'Contraseña segura (mínimo 6 caracteres)',
  })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 123,
    description: 'ID del profesional a vincular',
  })
  @IsNumber()
  @IsNotEmpty()
  profesionalId: number;
}
