import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { ChatMessageController } from './chatMessage.controller';
import { ChatMessageService } from './chatMessage.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatMessageController],
  providers: [ChatMessageService],
  exports: [ChatMessageService],
})
export class ChatMessageModule {}
