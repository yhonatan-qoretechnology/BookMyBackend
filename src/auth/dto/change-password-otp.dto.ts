import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';

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
    example: PASSWORD_EXAMPLE,
    description: `Nueva contraseña del usuario. ${PASSWORD_RULES_MESSAGE}`,
  })
  @IsStrongPassword()
  newPassword: string;
}
