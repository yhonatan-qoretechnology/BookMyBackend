import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Igual que ThrottlerGuard, pero si la request trae un Bearer token válido
 * usa el id del usuario como clave del límite en vez de la IP. Así un mismo
 * usuario no puede esquivar el límite cambiando de red, y varios usuarios
 * detrás de la misma IP (oficina, NAT) no comparten cupo.
 *
 * La verificación es "best-effort": un token inválido o ausente no bloquea
 * la request (el endpoint acepta uso anónimo), solo hace que se controle
 * por IP en vez de por usuario.
 */
@Injectable()
export class AssistantThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader = req.headers?.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;

    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        if (payload?.id) {
          req.assistantUserId = payload.id;
          return `user-${payload.id}`;
        }
      } catch {
        // Token inválido/expirado: seguimos por IP, no bloqueamos el endpoint.
      }
    }

    return req.ip;
  }

  /**
   * Respuesta 429 con el tiempo de espera explícito, para que la app pueda
   * mostrar "esperá X segundos" en vez de un error genérico, y reintentar
   * sola cuando corresponda.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(throttlerLimitDetail.timeToExpire),
    );

    const response = context.switchToHttp().getResponse();
    response.setHeader('Retry-After', retryAfterSeconds);

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Estás enviando mensajes muy rápido. Esperá ${retryAfterSeconds} segundo${retryAfterSeconds === 1 ? '' : 's'} e intentá de nuevo.`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
