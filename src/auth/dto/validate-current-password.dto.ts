import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class ValidateCurrentPasswordDto {
  @ApiProperty({
    example: 'OldPassword123',
    description: 'Contraseña actual del usuario.',
  })
  @IsNotEmpty()
  currentPassword: string;
}
