import { Injectable } from '@nestjs/common';
import { ConnectedUser } from './interface/connected-user.interface';

/**
 * Chat gateway service.
 *
 * Stores connected users in memory. Un usuario puede tener varias
 * pestañas (varios sockets): sigue «en línea» hasta que cierra la última.
 */
@Injectable()
export class ChatGatewayService {
  /**
   * Connected users.
   */
  private readonly connectedUsers = new Map<number, ConnectedUser>();
  /** userId → sockets abiertos */
  private readonly sockets = new Map<number, Set<string>>();

  /**
   * Register a connected user.
   *
   * @param user Connected user.
   */
  addUser(user: ConnectedUser): void {
    this.connectedUsers.set(user.userId, user);
    const abiertos = this.sockets.get(user.userId) ?? new Set<string>();
    abiertos.add(user.socketId);
    this.sockets.set(user.userId, abiertos);
  }

  /**
   * Remove a connected user.
   *
   * @param socketId Socket identifier.
   */
  removeUser(socketId: string): number | null {
    for (const [userId, abiertos] of this.sockets.entries()) {
      if (!abiertos.delete(socketId)) continue;
      if (abiertos.size === 0) {
        this.sockets.delete(userId);
        this.connectedUsers.delete(userId);
      } else {
        /* Los avisos siguen llegando a una pestaña que sigue abierta */
        const user = this.connectedUsers.get(userId);
        if (user && user.socketId === socketId) {
          this.connectedUsers.set(userId, { ...user, socketId: [...abiertos][0] });
        }
      }
      return userId;
    }
    return null;
  }

  /**
   * Find a connected user.
   *
   * @param userId User identifier.
   * @returns Connected user.
   */
  getUser(userId: number): ConnectedUser | undefined {
    return this.connectedUsers.get(userId);
  }

  /**
   * Get connected users.
   *
   * @returns Connected users.
   */
  getUsers(): ConnectedUser[] {
    return [...this.connectedUsers.values()];
  }

  /**
   * Check if a user is online.
   *
   * @param userId User identifier.
   * @returns True if connected.
   */
  isOnline(userId: number): boolean {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }
}
