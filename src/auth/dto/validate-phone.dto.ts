import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidatePhoneDto {
  @ApiProperty({
    example: '+34612345678',
    description: 'Número de teléfono en formato internacional (España)',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
