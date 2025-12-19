import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestPasswordOtpDto {
  @ApiProperty({
    example: 'example@example.com',
    description: 'Correo electrónico del usuario que solicita el OTP.',
  })
  @IsEmail()
  email: string;
}
