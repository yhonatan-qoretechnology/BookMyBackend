import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChatRequest(@Body('messages') messages: any[]) {
    return await this.chatService.getAiResponse(messages);
  }
}
