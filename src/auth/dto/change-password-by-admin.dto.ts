import { ApiProperty } from '@nestjs/swagger';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';

export class ChangePasswordByAdminDto {
  @ApiProperty({
    example: PASSWORD_EXAMPLE,
    description: `Nueva contraseña para el usuario. ${PASSWORD_RULES_MESSAGE}`,
  })
  @IsStrongPassword()
  newPassword: string;
}
