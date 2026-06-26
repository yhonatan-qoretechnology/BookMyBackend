import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

import { MessageType } from '../enums/message-type.enum';

/**
 * Send chat message DTO.
 */
export class SendMessageDto {
  @ApiProperty()
  @IsInt()
  senderId: number;

  @ApiProperty()
  @IsInt()
  receiverId: number;

  @ApiProperty()
  @IsEmail()
  senderEmail: string;

  @ApiProperty()
  @IsEmail()
  receiverEmail: string;

  @ApiProperty({
    enum: MessageType,
  })
  @IsEnum(MessageType)
  messageType: MessageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
