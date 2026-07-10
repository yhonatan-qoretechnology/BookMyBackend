import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ChatMessageService } from './chatMessage.service';
import { CreateChatContactDto } from './dto/create-chat-contact.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SearchUserDto } from './dto/search-chat-user.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('ChatMessage')
@Controller('ChatMessage')
export class ChatMessageController {
  constructor(private readonly chatMessageService: ChatMessageService) {}

  /**
   * Search users for chat contacts.
   */
  @Get('users')
  @ApiOperation({
    summary: 'Search users available for chat',
  })
  async findUserByEmail(@Query() query: SearchUserDto) {
    return this.chatMessageService.findUserByEmail(query);
  }

  @Post('contacts')
  @ApiOperation({
    summary: 'Save chat contact',
  })
  async createContact(@Body() dto: CreateChatContactDto) {
    return this.chatMessageService.createContact(dto);
  }

  /**
   * Get chat contacts.
   */
  @Get('contacts/:userId')
  @ApiOperation({
    summary: 'Get chat contacts',
  })
  async getContacts(@Param('userId', ParseIntPipe) userId: number) {
    return this.chatMessageService.getContacts(userId);
  }

  //enviar mensajes de chat

  /**
   * Get conversation messages.
   */
  @Get('messages/:userA/:userB')
  @ApiOperation({
    summary: 'Get conversation messages',
  })
  async getConversation(
    @Param('userA', ParseIntPipe) userA: number,
    @Param('userB', ParseIntPipe) userB: number,
  ) {
    return this.chatMessageService.getConversation(userA, userB);
  }

  @Post('messages')
  @ApiOperation({
    summary: 'Save chat message',
  })
  async createMessage(@Body() dto: SendMessageDto) {
    return this.chatMessageService.createMessage(dto);
  }

  @Post('messages/read')
  @ApiOperation({
    summary: 'Mark a chat message as read',
  })
  async markMessageAsRead(@Body() dto: MarkMessageReadDto) {
    return this.chatMessageService.markMessageAsRead(dto);
  }
}
