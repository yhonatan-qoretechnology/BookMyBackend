export const CHAT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const CHAT_DOCUMENT_MIME_TYPES = ['application/pdf'];

/**
 * Mimetypes produced by browser/mobile voice recorders
 * (MediaRecorder on web, native recorders on iOS/Android).
 */
export const CHAT_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
];

/**
 * Allowed MIME types for chat attachments.
 *
 * Images, PDF and audio (voice messages) today. Extend the type-specific
 * lists above to enable more attachment kinds in the future (e.g. video).
 */
export const CHAT_ALLOWED_MIME_TYPES = [
  ...CHAT_IMAGE_MIME_TYPES,
  ...CHAT_DOCUMENT_MIME_TYPES,
  ...CHAT_AUDIO_MIME_TYPES,
];

export const CHAT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const CHAT_UPLOAD_TEMP_DIR = './uploads/chatmessage/temp';

export const CHAT_UPLOAD_DIR = 'chatmessage';
