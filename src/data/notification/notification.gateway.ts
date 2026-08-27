import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../../auth/socket/socket-auth.service';
import { NotificationGatewayService } from './notification-gateway.service';

/**
 * Namespace propio ("/notifications") separado del chat, para no tocar ni
 * arriesgar ChatGateway (que ya funciona). El cliente (Bookmy-Admin o
 * appMovil) se conecta a este namespace y manda "connect_user" con su
 * userId apenas loguea, igual que ya hacen con el chat.
 */
@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gatewayService: NotificationGatewayService,
    private readonly socketAuth: SocketAuthService,
  ) {}

  /* La identidad se fija en el handshake, no en `connect_user`: si el token
     falta o no es válido, la conexión se cierra aquí mismo. */
  handleConnection(client: Socket) {
    if (!this.socketAuth.attach(client)) return;
    this.logger.log(`Socket de notificaciones conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.gatewayService.removeSocket(client.id);
    this.logger.log(`Socket de notificaciones desconectado: ${client.id}`);
  }

  /* El `userId` del cuerpo se ignora a propósito: manda el del token.
     Antes cualquiera podía declararse otro usuario y recibir sus avisos. */
  @SubscribeMessage('connect_user')
  connectUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { userId: number },
  ) {
    const auth = this.socketAuth.getUser(client);
    const userId = auth?.userId ?? dto?.userId;
    if (!userId) return;

    this.gatewayService.addSocket(userId, client.id);
    this.logger.log(
      `Usuario ${userId} registrado para notificaciones (socket ${client.id})`,
    );
    client.emit('user_connected', { success: true });
  }

  /** Empuja una notificación a todas las sesiones activas del usuario. */
  emitToUser(userId: number, notification: unknown): boolean {
    const sockets = this.gatewayService.getSockets(userId);
    if (sockets.length === 0) return false;

    for (const socketId of sockets) {
      this.server.to(socketId).emit('new_notification', notification);
    }
    return true;
  }
}
