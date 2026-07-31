import { BadRequestException } from '@nestjs/common';

import { CHAT_ALLOWED_MIME_TYPES, CHAT_AUDIO_MIME_TYPES } from './chat-file.constants';

type MulterFileFilter = (
  req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => void;

/**
 * Builds a multer fileFilter that only accepts the given mimetypes,
 * rejecting anything else before the file is written to disk.
 */
function createChatFileFilter(
  allowedMimeTypes: string[],
  errorMessage: string,
): MulterFileFilter {
  return (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new BadRequestException(errorMessage), false);
      return;
    }

    callback(null, true);
  };
}

/** Filter for POST /ChatMessage/upload (images and PDF). */
export const chatFileFilter = createChatFileFilter(
  CHAT_ALLOWED_MIME_TYPES,
  'Tipo de archivo no permitido. Solo se aceptan imágenes o PDF.',
);

/** Filter for POST /ChatMessage/upload-audio (voice messages). */
export const chatAudioFileFilter = createChatFileFilter(
  CHAT_AUDIO_MIME_TYPES,
  'Tipo de archivo no permitido. Solo se aceptan audios.',
);
