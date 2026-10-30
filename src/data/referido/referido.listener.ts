import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BOOKMY_EVENTS, EmpresaRegistradaEvento } from '../../common/events/event-names';
import { ReferidoService } from './referido.service';

/** Engancha los referidos a los eventos de alta y de pago de Pro. */
@Injectable()
export class ReferidoListener {
  constructor(private readonly referidos: ReferidoService) {}

  @OnEvent(BOOKMY_EVENTS.EMPRESA_REGISTRADA, { async: true })
  async alRegistrarse(evento: EmpresaRegistradaEvento) {
    if (!evento.codigoReferido) return;
    try {
      await this.referidos.vincular(evento.empresaId, evento.codigoReferido);
    } catch (error) {
      this.referidos.registrarError(`No se pudo vincular el referido de la empresa ${evento.empresaId}`, error);
    }
  }

  @OnEvent(BOOKMY_EVENTS.PLAN_PAGO_PAGADO, { async: true })
  async alPagarPro(evento: { empresaId: number }) {
    try {
      await this.referidos.recompensarSiCorresponde(evento.empresaId);
    } catch (error) {
      this.referidos.registrarError(`No se pudo recompensar el referido de la empresa ${evento.empresaId}`, error);
    }
  }
}
