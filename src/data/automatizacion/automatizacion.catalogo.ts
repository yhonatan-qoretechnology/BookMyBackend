import { BOOKMY_EVENTS, eventoActividad } from '../../common/events/event-names';
import { RECURSOS } from '../actividad/actividad.catalogo';

export interface EventoAutomatizable {
  evento: string;
  etiqueta: string;
  grupo: string;
}

/** Variables que se pueden usar en el asunto y el mensaje. */
export const VARIABLES = ['empresa', 'email', 'fecha', 'motivo', 'puntos', 'recurso', 'accion', 'recursoId'];

/**
 * Eventos que pueden disparar una automatización. Los de actividad se
 * generan a partir del catálogo de recursos del panel.
 */
export function eventosAutomatizables(): EventoAutomatizable[] {
  const negocio: EventoAutomatizable[] = [
    { evento: BOOKMY_EVENTS.EMPRESA_REGISTRADA, etiqueta: 'Un negocio nuevo se registra', grupo: 'Negocios' },
    { evento: BOOKMY_EVENTS.TRIAL_POR_VENCER, etiqueta: 'La prueba de Pro está por terminar', grupo: 'Plan Pro' },
    { evento: BOOKMY_EVENTS.PLAN_PAGO_PAGADO, etiqueta: 'Se registra un pago de Pro', grupo: 'Plan Pro' },
    { evento: BOOKMY_EVENTS.PLAN_PAGO_VENCIDO, etiqueta: 'Un pago de Pro vence', grupo: 'Plan Pro' },
    { evento: BOOKMY_EVENTS.USO_PRO_BAJO, etiqueta: 'Un negocio Pro apenas usa el panel', grupo: 'Plan Pro' },
    { evento: BOOKMY_EVENTS.USO_PRO_INUSUAL, etiqueta: 'Un negocio Pro tiene un uso inusual', grupo: 'Plan Pro' },
    { evento: BOOKMY_EVENTS.REFERIDO_RECOMPENSADO, etiqueta: 'Un negocio gana puntos por un referido', grupo: 'Referidos' },
    { evento: BOOKMY_EVENTS.INVENTARIO_CAMBIADO, etiqueta: 'Cambia el inventario de un negocio', grupo: 'Inventario' },
  ];
  const acciones: [string, string][] = [
    ['creado', 'se crea'],
    ['actualizado', 'se edita'],
    ['eliminado', 'se elimina'],
  ];
  const actividad: EventoAutomatizable[] = RECURSOS.filter((r) => r.notifica).flatMap((r) => [
    ...acciones.map(([accion, texto]) => ({
      evento: eventoActividad(r.recurso, accion),
      etiqueta: `${r.etiqueta}: ${texto}`,
      grupo: 'Actividad del panel',
    })),
    ...(r.recurso === 'cita'
      ? [
          { evento: eventoActividad('cita', 'cancelado'), etiqueta: 'Cita: se cancela', grupo: 'Actividad del panel' },
          { evento: eventoActividad('cita', 'reagendado'), etiqueta: 'Cita: se reagenda', grupo: 'Actividad del panel' },
        ]
      : []),
  ]);
  return [...negocio, ...actividad];
}

export function esEventoAutomatizable(evento: string): boolean {
  return eventosAutomatizables().some((e) => e.evento === evento);
}
