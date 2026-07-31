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
 * Allowed MIME types for the `POST /ChatMessage/upload` endpoint
 * (images and PDF). Voice messages go through the separate
 * `POST /ChatMessage/upload-audio` endpoint — see CHAT_AUDIO_MIME_TYPES.
 */
export const CHAT_ALLOWED_MIME_TYPES = [
  ...CHAT_IMAGE_MIME_TYPES,
  ...CHAT_DOCUMENT_MIME_TYPES,
];

export const CHAT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const CHAT_UPLOAD_TEMP_DIR = './uploads/chatmessage/temp';

/** Base folder for images/PDF from POST /ChatMessage/upload. */
export const CHAT_UPLOAD_DIR = 'chatmessage';

/** Separate subfolder for voice messages from POST /ChatMessage/upload-audio. */
export const CHAT_AUDIO_UPLOAD_DIR = 'chatmessage/audio';
