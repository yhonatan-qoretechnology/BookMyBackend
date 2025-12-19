import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordOtpDto {
  @ApiProperty({
    example: 'example@example.com',
    description: 'Correo electrónico asociado al usuario.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP recibido en el correo.',
  })
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'NewPassword123',
    description: 'Nueva contraseña del usuario. Mínimo 6 caracteres.',
  })
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
