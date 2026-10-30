/**
 * Nombres de los eventos de dominio que emiten los crons/servicios y que
 * escucha el motor de automatizaciones (y cualquier otro listener futuro).
 * Fuente única para no repetir el string a mano en cada lado.
 */
export const BOOKMY_EVENTS = {
  PLAN_PAGO_PAGADO: 'plan-pago.pagado',
  PLAN_PAGO_VENCIDO: 'plan-pago.vencido',
  TRIAL_POR_VENCER: 'trial.por-vencer',
  /** Cambió el catálogo o el stock de un negocio (ver StockService). */
  INVENTARIO_CAMBIADO: 'inventario.cambiado',
  /** Alta de un negocio desde la web (RegistroNegocioService). */
  EMPRESA_REGISTRADA: 'empresa.registrada',
  /** Un referido pagó su primer mes de Pro y se entregaron los puntos. */
  REFERIDO_RECOMPENSADO: 'referido.recompensado',
  /** Un negocio Pro apenas usa el panel (UsoProCron). */
  USO_PRO_BAJO: 'uso-pro.bajo',
  /** Un negocio Pro con uso fuera de lo normal (UsoProCron). */
  USO_PRO_INUSUAL: 'uso-pro.inusual',
} as const;

/** Prefijo de los eventos de actividad del panel: actividad.<recurso>.<accion>. */
export const PREFIJO_ACTIVIDAD = 'actividad';

export const eventoActividad = (recurso: string, accion: string) =>
  `${PREFIJO_ACTIVIDAD}.${recurso}.${accion}`;

/** Carga de cualquier evento actividad.* (ver ActividadService). */
export interface ActividadEvento {
  userId: number;
  email: string;
  rol: string;
  empresaId: number | null;
  sedeId: number | null;
  recurso: string;
  accion: string;
  recursoId: string | null;
  ruta: string;
}

/** Carga de EMPRESA_REGISTRADA. */
export interface EmpresaRegistradaEvento {
  empresaId: number;
  codigoReferido?: string | null;
}

/** Qué cambió en el inventario: viaja tal cual en el aviso a la web. */
export type MotivoInventario =
  | 'insumo-creado'
  | 'insumo-actualizado'
  | 'insumo-archivado'
  | 'imagenes-anadidas'
  | 'imagenes-quitadas'
  | 'stock-ajustado'
  | 'solicitud-aprobada';

/** Carga de BOOKMY_EVENTS.INVENTARIO_CAMBIADO. */
export interface InventarioCambiadoEvento {
  empresaId: number;
  motivo: MotivoInventario;
}
