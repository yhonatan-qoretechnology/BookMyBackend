import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActividadService } from './actividad.service';

const METODOS_QUE_CAMBIAN = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Global (APP_INTERCEPTOR): cada petición del panel que cambia algo y
 * termina bien se registra como actividad. Antes solo las reservas
 * generaban avisos; con esto, cualquier acción operativa los genera sin
 * tener que tocar cada servicio.
 *
 * Nunca afecta a la respuesta: el registro va después (tap) y en segundo
 * plano, con sus propios errores atrapados.
 */
@Injectable()
export class ActividadInterceptor implements NestInterceptor {
  constructor(private readonly actividad: ActividadService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const metodo: string = req.method;
    if (!METODOS_QUE_CAMBIAN.has(metodo) || !req.user) return next.handle();

    return next.handle().pipe(
      tap((respuesta) => {
        void this.actividad
          .registrar({
            user: req.user,
            metodo,
            ruta: String(req.originalUrl || req.url || '').split('?')[0],
            respuesta,
          })
          .catch(() => undefined);
      }),
    );
  }
}
