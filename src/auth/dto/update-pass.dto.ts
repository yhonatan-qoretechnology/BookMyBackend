import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class UpdatePassDto {
  @IsNotEmpty()
  @MinLength(6)
  @ApiProperty({
    example: 'newPassword123',
    description: 'La nueva contraseña del usuario. Mínimo 6 caracteres.',
  })
  newPassword: string;
}
