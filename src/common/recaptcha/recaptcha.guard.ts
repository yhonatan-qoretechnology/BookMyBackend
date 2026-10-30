import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiHeader } from '@nestjs/swagger';
import { RecaptchaService } from './recaptcha.service';

/** Cabecera en la que el navegador manda el token de reCAPTCHA v3. */
export const RECAPTCHA_HEADER = 'x-recaptcha-token';

const RECAPTCHA_META = 'recaptcha';

interface OpcionesRecaptcha {
  /** Debe coincidir con la `action` con la que la web pidió el token. */
  accion: string;
  /**
   * false = solo se verifica si el token viene. Para endpoints que
   * también usa la app móvil (login, registro), que no carga reCAPTCHA:
   * exigirlo la dejaría sin poder entrar. El throttling por IP sigue
   * protegiéndolos.
   */
  obligatorio?: boolean;
}

/**
 * Protege un endpoint con reCAPTCHA v3:
 *   @Recaptcha({ accion: 'contacto' })
 */
export function Recaptcha(opciones: OpcionesRecaptcha) {
  return applyDecorators(
    SetMetadata(RECAPTCHA_META, { obligatorio: true, ...opciones }),
    UseGuards(RecaptchaGuard),
    ApiHeader({
      name: RECAPTCHA_HEADER,
      required: opciones.obligatorio !== false,
      description: `Token de reCAPTCHA v3 con action "${opciones.accion}"`,
    }),
  );
}

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly recaptcha: RecaptchaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opciones = this.reflector.get<Required<OpcionesRecaptcha>>(RECAPTCHA_META, context.getHandler());
    if (!opciones) return true;

    const req = context.switchToHttp().getRequest();
    const token = req.headers?.[RECAPTCHA_HEADER] as string | undefined;

    if (!token && !opciones.obligatorio) return true;

    const resultado = await this.recaptcha.verificar(token, opciones.accion, req.ip);
    if (!resultado.ok) {
      throw new ForbiddenException({
        message: 'No pudimos comprobar que no eres un robot. Recarga la página e inténtalo de nuevo.',
        code: 'RECAPTCHA_FAILED',
      });
    }
    return true;
  }
}
