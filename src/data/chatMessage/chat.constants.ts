/**
 * WebSocket events.
 */
export const CHAT_EVENTS = {
  CONNECT_USER: 'connect_user',

  SEND_MESSAGE: 'send_message',

  RECEIVE_MESSAGE: 'receive_message',

  TYPING: 'typing',

  STOP_TYPING: 'stop_typing',

  MESSAGE_READ: 'message_read',

  USER_CONNECTED: 'user_connected',

  USER_DISCONNECTED: 'user_disconnected',

  /** Presencia: alguien abrió o cerró el chat (todas sus pestañas) */
  USER_ONLINE: 'user_online',

  USER_OFFLINE: 'user_offline',
} as const;
