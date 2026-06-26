import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt } from 'class-validator';

/**
 * Connected user DTO.
 */
export class UserConnectedDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsEmail()
  email: string;
}
