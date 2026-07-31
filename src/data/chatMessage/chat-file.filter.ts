import { BadRequestException } from '@nestjs/common';

import { CHAT_ALLOWED_MIME_TYPES } from './chat-file.constants';

/**
 * Multer fileFilter for chat attachments.
 *
 * Rejects any mimetype not present in CHAT_ALLOWED_MIME_TYPES before the
 * file is written to disk.
 */
export function chatFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!CHAT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(
      new BadRequestException(
        `Tipo de archivo no permitido. Solo se aceptan imágenes, PDF o audio.`,
      ),
      false,
    );
    return;
  }

  callback(null, true);
}
