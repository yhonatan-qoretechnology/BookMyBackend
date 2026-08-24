import { Injectable } from '@nestjs/common';

/**
 * Registro en memoria de qué sockets tiene abiertos cada usuario, para el
 * namespace de notificaciones. Un mismo usuario puede tener varias
 * conexiones activas (varias pestañas, web + móvil), por eso es un Set.
 */
@Injectable()
export class NotificationGatewayService {
  private readonly socketsByUser = new Map<number, Set<string>>();

  addSocket(userId: number, socketId: string): void {
    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.socketsByUser.set(userId, sockets);
  }

  removeSocket(socketId: string): void {
    for (const [userId, sockets] of this.socketsByUser.entries()) {
      if (sockets.delete(socketId) && sockets.size === 0) {
        this.socketsByUser.delete(userId);
      }
    }
  }

  getSockets(userId: number): string[] {
    return [...(this.socketsByUser.get(userId) ?? [])];
  }

  isOnline(userId: number): boolean {
    return (this.socketsByUser.get(userId)?.size ?? 0) > 0;
  }
}
