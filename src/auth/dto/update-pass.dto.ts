import { ApiProperty } from '@nestjs/swagger';
import {
  IsStrongPassword,
  PASSWORD_EXAMPLE,
  PASSWORD_RULES_MESSAGE,
} from '../common/validators/password.decorator';

export class UpdatePassDto {
  @IsStrongPassword()
  @ApiProperty({
    example: PASSWORD_EXAMPLE,
    description: `La nueva contraseña del usuario. ${PASSWORD_RULES_MESSAGE}`,
  })
  newPassword: string;
}
