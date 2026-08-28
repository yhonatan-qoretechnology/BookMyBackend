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
import { Role } from '@prisma/client';

import { Server, Socket } from 'socket.io';

import { SocketAuthService } from 'src/auth/socket/socket-auth.service';
import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
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
    private readonly socketAuth: SocketAuthService,
  ) {}

  /**
   * Identidad del socket para los permisos de ChatMessageService.
   *
   * Sale del JWT verificado en el handshake. Los valores que manda el cliente
   * (senderId, senderEmail) solo se usan si SOCKET_AUTH_REQUIRED=false, el
   * modo de compatibilidad con las versiones ya publicadas de la app.
   */
  private buildSocketAuthUser(
    client: Socket,
    userId: number,
    email: string,
  ): AuthenticatedUser {
    const auth = this.socketAuth.getUser(client);
    if (auth) return auth;

    return {
      userId,
      email,
      role: Role.CLIENT,
      empresaId: null,
      sedeId: null,
    };
  }

  /**
   * Client connected.
   */
  handleConnection(client: Socket) {
    if (!this.socketAuth.attach(client)) return;
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
    const auth = this.socketAuth.getUser(client);
    const userId = auth?.userId ?? dto.userId;
    const email = auth?.email || dto.email;

    this.gatewayService.addUser({ socketId: client.id, userId, email });

    this.logger.log(`User ${userId} connected with socket ${client.id}`);

    client.emit(CHAT_EVENTS.USER_CONNECTED, {
      success: true,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    /* El remitente es el del token: si no, cualquiera podía enviar
       mensajes firmados con el id de otra persona. */
    const remitente = this.buildSocketAuthUser(
      client,
      dto.senderId,
      dto.senderEmail,
    );
    const savedMessage = await this.chatMessageService.createMessage(
      { ...dto, senderId: remitente.userId, senderEmail: remitente.email },
      remitente,
    );
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
    const lector = this.buildSocketAuthUser(client, dto.userId, '');
    const updatedMessage = await this.chatMessageService.markMessageAsRead(
      { ...dto, userId: lector.userId },
      lector,
    );
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
