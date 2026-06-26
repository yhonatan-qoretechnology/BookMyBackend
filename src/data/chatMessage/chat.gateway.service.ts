import { Injectable } from '@nestjs/common';
import { ConnectedUser } from './interface/connected-user.interface';

/**
 * Chat gateway service.
 *
 * Stores connected users in memory.
 */
@Injectable()
export class ChatGatewayService {
  /**
   * Connected users.
   */
  private readonly connectedUsers = new Map<number, ConnectedUser>();

  /**
   * Register a connected user.
   *
   * @param user Connected user.
   */
  addUser(user: ConnectedUser): void {
    this.connectedUsers.set(user.userId, user);
  }

  /**
   * Remove a connected user.
   *
   * @param socketId Socket identifier.
   */
  removeUser(socketId: string): void {
    for (const [userId, user] of this.connectedUsers.entries()) {
      if (user.socketId === socketId) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
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
    return this.connectedUsers.has(userId);
  }
}
