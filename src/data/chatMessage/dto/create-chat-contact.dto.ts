import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

/**
 * Create chat contact DTO.
 */
export class CreateChatContactDto {
  @ApiProperty({
    example: 15,
    description: 'Contact user identifier.',
  })
  @IsInt()
  contactUserId: number;
}
