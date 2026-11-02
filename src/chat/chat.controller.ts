import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /* Va contra OpenAI con nuestra clave y sin tope: cualquier sesión lo usaba
     como LLM gratis. Si nadie lo llama ya (el asistente va por
     /api/assistant), lo suyo es borrarlo. */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async handleChatRequest(@Body('messages') messages: any[]) {
    return await this.chatService.getAiResponse(messages);
  }
}
