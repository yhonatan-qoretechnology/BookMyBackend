import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';

export class CompletePasswordSetupDto {
  @ApiProperty({ description: 'Token recibido en el enlace del correo.' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: PASSWORD_EXAMPLE,
    description: `Contrasena elegida por el empleado. ${PASSWORD_RULES_MESSAGE}`,
  })
  @IsStrongPassword()
  password: string;
}
