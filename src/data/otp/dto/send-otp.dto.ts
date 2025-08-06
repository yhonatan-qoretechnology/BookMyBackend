import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '+34612345678',
    description: 'Número de teléfono al que se enviará el OTP',
  })
  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;
}
