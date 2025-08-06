import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class SendSmsDto {
  @ApiProperty({
    example: '+347134445467',
    description: 'Número de teléfono del destinatario en formato internacional',
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'Tu código OTP es 123456',
    description: 'Mensaje a enviar',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
