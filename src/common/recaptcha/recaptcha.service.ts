import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Respuesta de https://www.google.com/recaptcha/api/siteverify (v3). */
interface RespuestaSiteverify {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export interface ResultadoRecaptcha {
  ok: boolean;
  /** Puntuación de Google (1 = humano, 0 = bot); null si no se verificó. */
  score: number | null;
  motivo?: string;
}

/**
 * Verificación de reCAPTCHA v3 contra Google.
 *
 * Sin RECAPTCHA_SECRET_KEY la verificación se desactiva (todo pasa) y se
 * avisa una vez en el log: así el desarrollo local y los entornos sin
 * claves siguen funcionando. En producción la clave TIENE que estar.
 *
 * Se comprueba también la `action`: un token sacado del formulario de
 * contacto no sirve para registrar un negocio.
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private avisadoSinClave = false;

  constructor(private readonly config: ConfigService) {}

  get activo(): boolean {
    return !!this.config.get<string>('RECAPTCHA_SECRET_KEY');
  }

  private get puntuacionMinima(): number {
    const n = Number(this.config.get<string>('RECAPTCHA_MIN_SCORE'));
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.5;
  }

  async verificar(token: string | undefined, accion: string, ip?: string): Promise<ResultadoRecaptcha> {
    const secreto = this.config.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secreto) {
      if (!this.avisadoSinClave) {
        this.logger.warn('RECAPTCHA_SECRET_KEY no está configurada: el CAPTCHA no se está verificando.');
        this.avisadoSinClave = true;
      }
      return { ok: true, score: null, motivo: 'desactivado' };
    }
    if (!token) return { ok: false, score: null, motivo: 'sin-token' };

    try {
      const cuerpo = new URLSearchParams({ secret: secreto, response: token });
      if (ip) cuerpo.set('remoteip', ip);
      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cuerpo,
        signal: AbortSignal.timeout(5000),
      });
      const datos = (await res.json()) as RespuestaSiteverify;

      if (!datos.success) {
        return { ok: false, score: null, motivo: (datos['error-codes'] ?? []).join(',') || 'invalido' };
      }
      if (datos.action && datos.action !== accion) {
        return { ok: false, score: datos.score ?? null, motivo: `accion-distinta:${datos.action}` };
      }
      const score = datos.score ?? 0;
      if (score < this.puntuacionMinima) {
        return { ok: false, score, motivo: 'puntuacion-baja' };
      }
      return { ok: true, score };
    } catch (error) {
      /* Si Google no responde no se bloquea a la gente: el throttling por
         IP sigue protegiendo el endpoint. Se deja constancia en el log. */
      this.logger.error(
        `No se pudo verificar reCAPTCHA (${accion}): ${error instanceof Error ? error.message : error}`,
      );
      return { ok: true, score: null, motivo: 'google-no-responde' };
    }
  }
}
