/**
 * Allowed MIME types for chat attachments.
 *
 * Currently limited to images and PDF. Extend this list to enable
 * additional attachment types in the future (e.g. audio, video, docs).
 */
export const CHAT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export const CHAT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const CHAT_UPLOAD_TEMP_DIR = './uploads/chatmessage/temp';

export const CHAT_UPLOAD_DIR = 'chatmessage';
