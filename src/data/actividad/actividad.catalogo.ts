/**
 * Catálogo de lo que se puede hacer en el panel, para traducir una
 * petición HTTP ("POST /clients") a una acción con nombre ("cliente
 * creado"). Lo usan ActividadInterceptor (para registrar), el listener
 * de notificaciones (para el texto) y las automatizaciones (para listar
 * los eventos que se pueden escuchar).
 *
 * `segmento` es el primer tramo de la ruta. Si una ruta no está aquí, la
 * acción se registra igual (recurso = el segmento) pero no notifica.
 */
export interface RecursoPanel {
  segmento: string;
  recurso: string;
  /** Nombre en singular para los textos ("Cliente", "Cita"…). */
  etiqueta: string;
  /** Pantalla del panel a la que lleva la notificación. */
  ruta: string;
  /** false = se registra pero no avisa (cambios menores o muy frecuentes). */
  notifica: boolean;
}

export const RECURSOS: RecursoPanel[] = [
  { segmento: 'clients', recurso: 'cliente', etiqueta: 'Cliente', ruta: '/clientes', notifica: true },
  { segmento: 'appointments', recurso: 'cita', etiqueta: 'Cita', ruta: '/reservas', notifica: true },
  { segmento: 'payments', recurso: 'pago', etiqueta: 'Pago / factura', ruta: '/facturacion', notifica: true },
  { segmento: 'profesionales', recurso: 'profesional', etiqueta: 'Profesional', ruta: '/personal', notifica: true },
  { segmento: 'services', recurso: 'servicio', etiqueta: 'Servicio', ruta: '/servicios', notifica: true },
  { segmento: 'service-sede-profesional', recurso: 'asignacion', etiqueta: 'Asignación de servicio', ruta: '/servicios', notifica: false },
  { segmento: 'sedes', recurso: 'sede', etiqueta: 'Sede', ruta: '/sedes', notifica: true },
  { segmento: 'gastos', recurso: 'gasto', etiqueta: 'Gasto', ruta: '/facturacion/gastos', notifica: true },
  { segmento: 'categorias-gasto', recurso: 'categoria-gasto', etiqueta: 'Categoría de gasto', ruta: '/facturacion/gastos', notifica: false },
  { segmento: 'stock', recurso: 'inventario', etiqueta: 'Inventario', ruta: '/stock', notifica: true },
  { segmento: 'resenas', recurso: 'resena', etiqueta: 'Reseña', ruta: '/resenas', notifica: true },
  { segmento: 'empresas', recurso: 'empresa', etiqueta: 'Empresa', ruta: '/configuracion', notifica: true },
  { segmento: 'admin', recurso: 'administrador', etiqueta: 'Administrador', ruta: '/administradores', notifica: true },
  { segmento: 'festivos', recurso: 'festivo', etiqueta: 'Festivo', ruta: '/calendario', notifica: false },
  { segmento: 'horario-sede', recurso: 'horario', etiqueta: 'Horario', ruta: '/sedes', notifica: false },
  { segmento: 'dias-cerrados', recurso: 'dia-cerrado', etiqueta: 'Día cerrado', ruta: '/calendario', notifica: false },
  { segmento: 'disponibilidad-profesional', recurso: 'disponibilidad', etiqueta: 'Disponibilidad', ruta: '/personal', notifica: false },
  { segmento: 'categories', recurso: 'categoria', etiqueta: 'Categoría', ruta: '/servicios', notifica: false },
  { segmento: 'referidos', recurso: 'referido', etiqueta: 'Referido', ruta: '/referidos', notifica: false },
  { segmento: 'automatizaciones', recurso: 'automatizacion', etiqueta: 'Automatización', ruta: '/automatizaciones', notifica: false },
];

/**
 * Rutas que NO son actividad operativa: sesión, lecturas marcadas,
 * telemetría, chat (tiene sus propios avisos), webhooks… Prefijos.
 */
export const RUTAS_IGNORADAS = [
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/register',
  '/auth/users/password',
  '/auth/password-setup',
  '/notifications',
  '/telemetria',
  '/ChatMessage',
  '/chat',
  '/assistant',
  '/contacto',
  '/payments/stripe/webhook',
  '/entity-view',
  '/user-location',
];

/** Verbo según el final de la ruta o el método HTTP. */
export function accionDe(metodo: string, ruta: string): string {
  const fin = ruta.split('/').filter(Boolean).pop() ?? '';
  const especiales: Record<string, string> = {
    cancel: 'cancelado',
    reschedule: 'reagendado',
    extend: 'extendido',
    aprobar: 'aprobado',
    rechazar: 'rechazado',
    bloquear: 'bloqueado',
    desbloquear: 'desbloqueado',
    password: 'cambio-contrasena',
    'vincular-acceso': 'acceso-dado',
    acceso: 'acceso-cambiado',
  };
  if (especiales[fin]) return especiales[fin];
  if (metodo === 'POST') return 'creado';
  if (metodo === 'DELETE') return 'eliminado';
  return 'actualizado';
}

/** Texto en pasado para las notificaciones ("creó", "canceló"…). */
export const VERBOS: Record<string, string> = {
  creado: 'creó',
  actualizado: 'actualizó',
  eliminado: 'eliminó',
  cancelado: 'canceló',
  reagendado: 'reagendó',
  extendido: 'extendió',
  aprobado: 'aprobó',
  rechazado: 'rechazó',
  bloqueado: 'bloqueó',
  desbloqueado: 'desbloqueó',
  'cambio-contrasena': 'cambió la contraseña de',
  'acceso-dado': 'dio acceso al panel a',
  'acceso-cambiado': 'cambió el acceso de',
};

export function recursoDeRuta(ruta: string): RecursoPanel | null {
  const segmento = ruta.split('/').filter(Boolean)[0] ?? '';
  return RECURSOS.find((r) => r.segmento === segmento) ?? null;
}

/** Etiqueta corta de la acción para el título de la notificación. */
export const ACCIONES: Record<string, string> = {
  creado: 'nuevo',
  actualizado: 'editado',
  eliminado: 'eliminado',
  cancelado: 'cancelado',
  reagendado: 'reagendado',
  extendido: 'extendido',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
  bloqueado: 'bloqueado',
  desbloqueado: 'desbloqueado',
  'cambio-contrasena': 'contraseña cambiada',
  'acceso-dado': 'acceso al panel',
  'acceso-cambiado': 'acceso cambiado',
};
