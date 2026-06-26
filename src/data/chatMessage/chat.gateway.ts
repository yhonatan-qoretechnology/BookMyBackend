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
import { UserConnectedDto } from './dto/user-connected.dto';

@WebSocketGateway({
  cors: true,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly gatewayService: ChatGatewayService) {}

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
}
