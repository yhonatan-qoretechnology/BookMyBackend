/**
 * Nombres de los eventos de dominio que emiten los crons/servicios y que
 * escucha el motor de automatizaciones (y cualquier otro listener futuro).
 * Fuente única para no repetir el string a mano en cada lado.
 */
export const BOOKMY_EVENTS = {
  PLAN_PAGO_PAGADO: 'plan-pago.pagado',
  PLAN_PAGO_VENCIDO: 'plan-pago.vencido',
  TRIAL_POR_VENCER: 'trial.por-vencer',
} as const;
