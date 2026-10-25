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
} as const;

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
