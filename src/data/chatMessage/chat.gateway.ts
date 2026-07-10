import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Logger } from '@nestjs/common';

import { Server, Socket } from 'socket.io';

import { CHAT_EVENTS } from './chat.constants';
import { ChatGatewayService } from './chat.gateway.service';
import { ChatMessageService } from './chatMessage.service';
import { SendMessageDto } from './dto/send-message.dto';
import { TypingDto } from './dto/typing.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { UserConnectedDto } from './dto/user-connected.dto';

@WebSocketGateway({
  cors: true,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gatewayService: ChatGatewayService,
    private readonly chatMessageService: ChatMessageService,
  ) {}

  /**
   * Client connected.
   */
  handleConnection(client: Socket) {
    this.logger.log(`Socket connected: ${client.id}`);
  }

  /**
   * Client disconnected.
   */
  handleDisconnect(client: Socket) {
    this.gatewayService.removeUser(client.id);

    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  /**
   * Register connected user.
   */
  @SubscribeMessage(CHAT_EVENTS.CONNECT_USER)
  connectUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UserConnectedDto,
  ) {
    this.gatewayService.addUser({
      socketId: client.id,
      userId: dto.userId,
      email: dto.email,
    });

    this.logger.log(`User ${dto.userId} connected with socket ${client.id}`);

    client.emit(CHAT_EVENTS.USER_CONNECTED, {
      success: true,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const savedMessage = await this.chatMessageService.createMessage(dto);
    const receiver = this.gatewayService.getUser(dto.receiverId);

    if (receiver) {
      this.server
        .to(receiver.socketId)
        .emit(CHAT_EVENTS.RECEIVE_MESSAGE, savedMessage);
    }

    client.emit(CHAT_EVENTS.RECEIVE_MESSAGE, savedMessage);

    return {
      success: true,
      data: savedMessage,
    };
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING)
  handleTyping(
    @ConnectedSocket() _client: Socket,
    @MessageBody() dto: TypingDto,
  ) {
    const receiver = this.gatewayService.getUser(dto.receiverId);
    if (receiver) {
      this.server.to(receiver.socketId).emit(CHAT_EVENTS.TYPING, dto);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.STOP_TYPING)
  handleStopTyping(
    @ConnectedSocket() _client: Socket,
    @MessageBody() dto: TypingDto,
  ) {
    const receiver = this.gatewayService.getUser(dto.receiverId);
    if (receiver) {
      this.server.to(receiver.socketId).emit(CHAT_EVENTS.STOP_TYPING, dto);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_READ)
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MarkMessageReadDto,
  ) {
    const updatedMessage = await this.chatMessageService.markMessageAsRead(dto);
    const sender = this.gatewayService.getUser(updatedMessage.sender_id);

    if (sender) {
      this.server.to(sender.socketId).emit(CHAT_EVENTS.MESSAGE_READ, {
        chatId: updatedMessage.id,
        readerId: dto.userId,
        readAt: updatedMessage.read_at,
      });
    }

    client.emit(CHAT_EVENTS.MESSAGE_READ, {
      chatId: updatedMessage.id,
      readerId: dto.userId,
      readAt: updatedMessage.read_at,
    });

    return {
      success: true,
      data: updatedMessage,
    };
  }
}
