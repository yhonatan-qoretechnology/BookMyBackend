export const GASTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export const GASTO_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const GASTO_UPLOAD_TEMP_DIR = './uploads/gastos/temp';

/** Base folder for tickets uploaded from POST /gastos/upload. */
export const GASTO_UPLOAD_DIR = 'gastos';
