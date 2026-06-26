import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateChatContactDto {
  @ApiProperty()
  @IsInt()
  ownerUserId: number;

  @ApiProperty()
  @IsInt()
  contactUserId: number;
}
