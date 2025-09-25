import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: 'email@example.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail()
  email: string;
}
