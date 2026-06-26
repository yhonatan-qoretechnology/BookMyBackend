import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

/**
 * Typing event DTO.
 */
export class TypingDto {
  @ApiProperty()
  @IsInt()
  senderId: number;

  @ApiProperty()
  @IsInt()
  receiverId: number;
}
