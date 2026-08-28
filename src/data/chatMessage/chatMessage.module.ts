import { Module } from '@nestjs/common';

import { AccessControlService } from 'src/auth/services/access-control/access-control.service';
import { PrismaModule } from 'src/prisma/prisma.module';

import { ChatGateway } from './chat.gateway';
import { ChatGatewayService } from './chat.gateway.service';
import { ChatMessageController } from './chatMessage.controller';
import { ChatMessageService } from './chatMessage.service';
import { SocketAuthModule } from '../../auth/socket/socket-auth.module';

@Module({
  imports: [SocketAuthModule, PrismaModule],

  controllers: [ChatMessageController],

  providers: [
    ChatMessageService,
    ChatGateway,
    ChatGatewayService,
    AccessControlService,
  ],

  exports: [ChatMessageService, ChatGatewayService],
})
export class ChatMessageModule {}
