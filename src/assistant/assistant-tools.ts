/**
 * Catálogo de "tools" (function calling) que el asistente puede pedirle a la
 * app que ejecute. El backend SOLO define el esquema y se lo pasa al LLM;
 * la ejecución real de cada tool ocurre del lado del cliente (app móvil),
 * contra los endpoints REST que ya existen (ver mapeo en cada comentario).
 *
 * Mantené este catálogo versionado acá (no en la app) para poder agregar o
 * ajustar tools sin tener que republicar el cliente.
 */

export interface AssistantToolDefinition {
  name: string;
  description: string;
  /** JSON Schema (draft-07 subset) de los parámetros de la tool. */
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /**
   * Tools de escritura que la app NO debe ejecutar sin que el usuario
   * confirme explícitamente antes (por voz o tocando un botón).
   */
  requiresConfirmation?: boolean;
}

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: 'buscar_todo',
    description:
      'Búsqueda general por palabra clave (ej. "manicura", "uñas", "masajes") que devuelve en un solo llamado las categorías, servicios, sedes y profesionales que hacen match. Se resuelve con GET /search?q=. Usala primero para cualquier búsqueda abierta del usuario; reservá "buscar_categoria" + "listar_servicios_categoria" solo para cuando ya sabés la categoría exacta y querés navegarla paso a paso.',
    parameters: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Palabra o frase a buscar.',
        },
      },
      required: ['q'],
    },
  },
  {
    name: 'buscar_categoria',
    description:
      'Busca categorías de servicios disponibles (ej. Uñas, Cabello, Masajes) que hagan match con un texto. Se resuelve con GET /categories.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto para filtrar categorías por nombre.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'listar_servicios_categoria',
    description:
      'Lista los servicios disponibles dentro de una categoría. Se resuelve con GET /services/category/{id}.',
    parameters: {
      type: 'object',
      properties: {
        categoryId: {
          type: 'number',
          description: 'ID de la categoría (obtenido con buscar_categoria).',
        },
      },
      required: ['categoryId'],
    },
  },
  {
    name: 'listar_sedes_empresa',
    description:
      'Lista las sedes/sucursales de una empresa. Se resuelve con GET /sedes/empresa/{id}.',
    parameters: {
      type: 'object',
      properties: {
        companyId: {
          type: 'number',
          description: 'ID de la empresa.',
        },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'listar_servicios_sede',
    description:
      'Lista los servicios que ofrece una sede específica. Se resuelve con GET /services/by-sede/{id}.',
    parameters: {
      type: 'object',
      properties: {
        sedeId: {
          type: 'number',
          description: 'ID de la sede.',
        },
      },
      required: ['sedeId'],
    },
  },
  {
    name: 'ver_profesional',
    description:
      'Obtiene el detalle de un profesional (biografía, sede, servicios que ofrece). Se resuelve con GET /profesionales/{id}/detalle.',
    parameters: {
      type: 'object',
      properties: {
        profesionalId: {
          type: 'number',
          description: 'ID del profesional.',
        },
      },
      required: ['profesionalId'],
    },
  },
  {
    name: 'consultar_mis_citas',
    description:
      'Devuelve las citas del usuario autenticado, opcionalmente filtradas por estado. Se resuelve con GET /appointments/users/{userId}/services usando el token del usuario. Requiere que el usuario tenga sesión iniciada.',
    parameters: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['pending', 'completed'],
          description: 'Filtro opcional de estado de las citas.',
        },
      },
    },
  },
  {
    name: 'iniciar_reserva',
    description:
      'Navega a la pantalla de reserva con el servicio/sede preseleccionados (y opcionalmente profesional/fecha/hora). NO crea la cita ni cobra: el usuario termina de confirmar fecha/hora y paga desde esa pantalla. Es solo navegación del lado del cliente, no llama a ningún endpoint de escritura.',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'number' },
        sedeId: { type: 'number' },
        profesionalId: { type: 'number' },
        fecha: { type: 'string', description: 'Fecha preferida, formato YYYY-MM-DD.' },
        hora: { type: 'string', description: 'Hora preferida, formato HH:mm.' },
      },
      required: ['serviceId', 'sedeId'],
    },
  },
  {
    name: 'cancelar_cita',
    description:
      'Cancela una cita existente. Se resuelve con PATCH /appointments/{id}/cancel. IMPORTANTE: es la única tool de escritura del catálogo. Antes de llamarla, confirmá en voz alta con el usuario cuál cita cancelar y esperá una confirmación explícita ("sí", "confirmo", etc.) en un turno anterior. Nunca la llames en el mismo turno en que el usuario pidió cancelar por primera vez.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'number' },
      },
      required: ['appointmentId'],
    },
    requiresConfirmation: true,
  },
  {
    name: 'ir_a_pantalla',
    description:
      'Navega a una pantalla general de la app (no relacionada a un servicio/reserva puntual).',
    parameters: {
      type: 'object',
      properties: {
        pantalla: {
          type: 'string',
          enum: [
            'inicio',
            'reservas',
            'perfil',
            'notificaciones',
            'puntos',
            'metodos_pago',
            'ubicaciones',
            'ayuda',
          ],
        },
      },
      required: ['pantalla'],
    },
  },
];

export const TOOLS_REQUIRING_CONFIRMATION = ASSISTANT_TOOLS.filter(
  (tool) => tool.requiresConfirmation,
).map((tool) => tool.name);

export const ASSISTANT_SYSTEM_PROMPT = `Sos el asistente virtual de BookMy, una app para reservar citas en salones de belleza y centros de estética.

Reglas:
- Respondé siempre en español, de forma breve, cálida y natural (el usuario puede estar escuchando por voz).
- Nunca uses markdown: nada de **negritas**, ### títulos, listas con guiones/números ni backticks. Tu respuesta se lee en voz alta con un sintetizador de voz, así que tiene que ser prosa corrida, como si se lo estuvieras contando a alguien. Si son varias opciones, nombralas dentro de la misma frase (ej. "tenemos manicura semipermanente por 25 euros y manicura tradicional por 18 euros") en vez de listarlas con viñetas. Si son muchas opciones (más de 3-4), no las recites todas: mencioná 2 o 3 destacadas y preguntá si quiere que le cuentes el resto.
- Usá las tools disponibles para buscar información real (categorías, servicios, sedes, profesionales, citas) en vez de inventar datos. Nunca inventes IDs, precios, horarios ni disponibilidad: si no los tenés, consultalos con una tool.
- Para búsquedas abiertas por palabra clave (ej. "quiero manicura", "qué tienen de uñas", "sedes en Marbella") usá primero "buscar_todo": te devuelve categorías, servicios, sedes y profesionales que matchean en un solo llamado. Solo encadenes "buscar_categoria" + "listar_servicios_categoria" cuando ya sepas la categoría exacta y quieras navegarla paso a paso.
- Para reservar: vos NO creás la cita ni cobrás. Cuando el usuario tenga claro qué servicio/sede quiere (y opcionalmente profesional/fecha/hora), usá "iniciar_reserva" para llevarlo a la pantalla donde termina de elegir fecha/hora y paga. Nunca digas que "la reserva quedó confirmada": eso solo pasa en esa pantalla, después del pago.
- "cancelar_cita" es la única acción de escritura real y es irreversible. Antes de llamarla, resumí en voz alta cuál cita se va a cancelar y preguntá explícitamente si confirma. Solo llamá la tool en el turno siguiente, después de una confirmación clara ("sí", "confirmo", "dale", etc.). Si el usuario no confirma o cambia de idea, no la ejecutes.
- El resto de las tools (buscar_categoria, listar_servicios_categoria, listar_sedes_empresa, listar_servicios_sede, ver_profesional, consultar_mis_citas, iniciar_reserva, ir_a_pantalla) son de lectura o navegación: podés llamarlas directamente cuando ayuden a responder, sin pedir confirmación.
- Si falta información necesaria para una tool (por ejemplo no sabés el sedeId), preguntale al usuario o usá otra tool para averiguarlo primero.`;
