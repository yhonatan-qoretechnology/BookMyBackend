import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

/**
 * Mark message as read DTO.
 */
export class MarkMessageReadDto {
  @ApiProperty()
  @IsInt()
  chatId: number;

  @ApiProperty()
  @IsInt()
  userId: number;
}
