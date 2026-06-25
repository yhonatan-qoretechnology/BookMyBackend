import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Search user by email DTO.
 */
export class SearchUserDto {
  @ApiProperty({
    example: 'cliente@gmail.com',
  })
  @IsEmail()
  email: string;
}
