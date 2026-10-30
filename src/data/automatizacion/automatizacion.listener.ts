import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomatizacionService } from './automatizacion.service';

/**
 * Pasa TODOS los eventos de dominio al motor de automatizaciones con su
 * nombre. `onAny` es la única forma de recibir el nombre del evento
 * (@OnEvent('**') de Nest lo pierde al envolver el handler).
 */
@Injectable()
export class AutomatizacionListener implements OnModuleInit, OnModuleDestroy {
  private readonly escuchar = (evento: string | string[], payload: unknown) => {
    const nombre = Array.isArray(evento) ? evento.join('.') : evento;
    if (payload && typeof payload === 'object') {
      void this.motor.encolar(nombre, payload as Record<string, unknown>);
    }
  };

  constructor(
    private readonly eventos: EventEmitter2,
    private readonly motor: AutomatizacionService,
  ) {}

  onModuleInit() {
    this.eventos.onAny(this.escuchar);
  }

  onModuleDestroy() {
    this.eventos.offAny(this.escuchar);
  }
}
