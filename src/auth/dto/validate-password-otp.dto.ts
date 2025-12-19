import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ValidatePasswordOtpDto {
  @ApiProperty({
    example: 'example@example.com',
    description: 'Correo del usuario donde se envió el OTP.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP recibido por el usuario.',
  })
  @IsNotEmpty()
  code: string;
}
