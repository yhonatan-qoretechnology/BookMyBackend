import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+573001112233' })
  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @IsString()
  code: string;
}
