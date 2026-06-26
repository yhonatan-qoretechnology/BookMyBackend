import { Socket } from 'socket.io';

/**
 * Socket user information.
 */
export interface SocketUser {
  socket: Socket;
  userId: number;
  email: string;
}
