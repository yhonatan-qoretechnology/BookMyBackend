import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123!',
    description: 'Contraseña actual del usuario.',
  })
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: PASSWORD_EXAMPLE,
    description: `Nueva contraseña del usuario. ${PASSWORD_RULES_MESSAGE}`,
  })
  @IsStrongPassword()
  newPassword: string;
}
