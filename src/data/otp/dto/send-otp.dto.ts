import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '+348001112233',
    description: 'Número de teléfono al que se enviará el OTP',
  })
  @IsNotEmpty()
  @IsString()
  phone: string;
}
