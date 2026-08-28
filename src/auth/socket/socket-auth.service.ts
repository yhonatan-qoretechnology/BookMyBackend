import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Autenticación del handshake de socket.io.
 *
 * Antes los dos gateways (chat y notificaciones) se creían el `userId` que el
 * cliente mandaba en `connect_user`: bastaba con conectarse y declararse otro
 * usuario para recibir sus mensajes y sus notificaciones. Aquí la identidad
 * sale del JWT y el cliente ya no opina.
 *
 * El token se busca, por este orden, en:
 *   1. `handshake.auth.token`      → io(url, { auth: { token } })   ← recomendado
 *   2. cabecera `Authorization`    → "Bearer xxx"
 *   3. `handshake.query.token`     → último recurso
 */
@Injectable()
export class SocketAuthService {
  private readonly logger = new Logger(SocketAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * `false` permite que un cliente sin token siga conectándose con la
   * identidad que declara (el comportamiento antiguo).
   *
   * Existe solo para desplegar el backend ANTES de que salga la versión de la
   * app móvil que manda el token: las builds ya publicadas en las tiendas no
   * lo envían y se quedarían sin chat ni notificaciones. Vuelve a `true`
   * (el valor por defecto) en cuanto esa versión esté fuera.
   */
  private get authRequired(): boolean {
    return this.configService.get<string>('SOCKET_AUTH_REQUIRED') !== 'false';
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake?.auth as
      | { token?: string }
      | undefined;
    if (typeof auth?.token === 'string' && auth.token) return auth.token;

    const header = client.handshake?.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    const query = client.handshake?.query?.token;
    if (typeof query === 'string' && query) return query;

    return null;
  }

  /**
   * Resuelve la identidad del socket.
   *
   * @returns el usuario autenticado, o `null` si hay que rechazar la conexión.
   */
  authenticate(client: Socket): AuthenticatedUser | null {
    const token = this.extractToken(client);

    if (!token) {
      if (this.authRequired) {
        this.logger.warn(`Socket ${client.id} sin token: conexión rechazada`);
        return null;
      }
      this.logger.warn(
        `Socket ${client.id} sin token: aceptado por SOCKET_AUTH_REQUIRED=false`,
      );
      return null;
    }

    try {
      const payload = this.jwtService.verify<{
        id?: number;
        email?: string;
        role?: Role;
        empresaId?: number | null;
        sedeId?: number | null;
        profesionalId?: number | null;
      }>(token);

      if (!payload?.id) {
        this.logger.warn(`Socket ${client.id}: token sin id`);
        return null;
      }

      return {
        userId: payload.id,
        email: payload.email ?? '',
        role: payload.role ?? Role.CLIENT,
        empresaId: payload.empresaId ?? null,
        sedeId: payload.sedeId ?? null,
        profesionalId: payload.profesionalId ?? null,
      };
    } catch {
      this.logger.warn(`Socket ${client.id}: token inválido o caducado`);
      return null;
    }
  }

  /**
   * Autentica y deja la identidad en `client.data.user`.
   *
   * @returns `true` si la conexión puede continuar. Si no, ya se ha
   *          desconectado al cliente.
   */
  attach(client: Socket): boolean {
    const user = this.authenticate(client);

    if (user) {
      client.data.user = user;
      return true;
    }

    if (this.authRequired) {
      client.emit('unauthorized', {
        message: 'Token no válido. Vuelve a iniciar sesión.',
      });
      client.disconnect(true);
      return false;
    }

    return true; // modo compatibilidad: sin identidad verificada
  }

  /** Identidad verificada del socket, si la hay. */
  getUser(client: Socket): AuthenticatedUser | null {
    return (client.data?.user as AuthenticatedUser | undefined) ?? null;
  }
}
