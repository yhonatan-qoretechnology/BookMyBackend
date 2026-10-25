import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BOOKMY_EVENTS,
  InventarioCambiadoEvento,
  MotivoInventario,
} from '../../common/events/event-names';

/** Lo que se espera a que acabe una ráfaga de cambios antes de avisar. */
const ESPERA_MS = 1500;
/** Lo que se espera a la web antes de darla por caída. */
const TIEMPO_MAXIMO_MS = 5000;

/**
 * Avisa a la web de un negocio cuando cambia su inventario, para que
 * refresque su catálogo al momento en vez de esperar a su propia recarga.
 *
 * Solo para el negocio de CATALOGO_WEB_EMPRESA_ID y solo con las tres
 * variables puestas; si no, no se avisa a nadie. Una importación son decenas
 * de cambios seguidos, así que se agrupan en un aviso por negocio. Sin
 * reintentos: un aviso que falla se apunta y ya, porque la web se refresca
 * sola cada pocos minutos.
 */
@Injectable()
export class CatalogoWebListener implements OnModuleInit {
  private readonly logger = new Logger(CatalogoWebListener.name);
  private readonly url: string;
  private readonly secreto: string;
  private readonly empresaId: number;
  private readonly pendientes = new Map<number, NodeJS.Timeout>();

  constructor(configService: ConfigService) {
    this.url =
      configService.get<string>('CATALOGO_WEB_WEBHOOK_URL')?.trim() ?? '';
    this.secreto =
      configService.get<string>('CATALOGO_WEB_WEBHOOK_SECRET')?.trim() ?? '';
    this.empresaId = Number(configService.get('CATALOGO_WEB_EMPRESA_ID')) || 0;
  }

  onModuleInit() {
    const puestas = [this.url, this.secreto, this.empresaId].filter(Boolean);
    if (puestas.length === 3) {
      this.logger.log(
        `Aviso a la web activo para la empresa ${this.empresaId} (${new URL(this.url).origin}).`,
      );
    } else if (puestas.length > 0) {
      this.logger.warn(
        'Aviso a la web a medio configurar: hacen falta CATALOGO_WEB_WEBHOOK_URL, ' +
          'CATALOGO_WEB_WEBHOOK_SECRET y CATALOGO_WEB_EMPRESA_ID. No se avisará.',
      );
    }
  }

  @OnEvent(BOOKMY_EVENTS.INVENTARIO_CAMBIADO)
  alCambiarInventario({ empresaId, motivo }: InventarioCambiadoEvento) {
    if (!this.url || !this.secreto || empresaId !== this.empresaId) return;

    clearTimeout(this.pendientes.get(empresaId));
    const temporizador = setTimeout(() => {
      this.pendientes.delete(empresaId);
      void this.avisar(empresaId, motivo);
    }, ESPERA_MS);
    /* Un aviso pendiente no retiene el proceso al apagarlo. */
    temporizador.unref();
    this.pendientes.set(empresaId, temporizador);
  }

  private async avisar(empresaId: number, motivo: MotivoInventario) {
    try {
      const respuesta = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secreto}`,
        },
        body: JSON.stringify({
          evento: BOOKMY_EVENTS.INVENTARIO_CAMBIADO,
          empresaId,
          motivo,
          fecha: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      await respuesta.body?.cancel();
      if (respuesta.ok) {
        this.logger.log(
          `Web avisada del cambio de inventario de la empresa ${empresaId} (${motivo}).`,
        );
      } else {
        this.logger.warn(
          `La web respondió ${respuesta.status} al aviso de inventario de la empresa ${empresaId}.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo avisar a la web del cambio de inventario de la empresa ${empresaId}: ${(error as Error).message}`,
      );
    }
  }
}
