import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidatePhoneDto {
  @ApiProperty({
    example: '+348001112233',
    description: 'Número de teléfono en formato internacional (España)',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
