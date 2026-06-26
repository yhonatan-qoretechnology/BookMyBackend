import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';

import { ChatGateway } from './chat.gateway';
import { ChatGatewayService } from './chat.gateway.service';
import { ChatMessageController } from './chatMessage.controller';
import { ChatMessageService } from './chatMessage.service';

@Module({
  imports: [PrismaModule],

  controllers: [ChatMessageController],

  providers: [ChatMessageService, ChatGateway, ChatGatewayService],

  exports: [ChatMessageService, ChatGatewayService],
})
export class ChatMessageModule {}
