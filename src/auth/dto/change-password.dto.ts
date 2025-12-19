import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123',
    description: 'Contraseña actual del usuario.',
  })
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword123',
    description: 'Nueva contraseña del usuario. Mínimo 6 caracteres.',
  })
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
