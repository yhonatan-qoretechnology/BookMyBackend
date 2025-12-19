import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordByAdminDto {
  @ApiProperty({
    example: 'NewPassword123',
    description: 'Nueva contraseña para el usuario.',
  })
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
