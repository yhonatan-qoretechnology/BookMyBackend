import { BadRequestException } from '@nestjs/common';
import { GASTO_ALLOWED_MIME_TYPES } from './gasto-file.constants';

type MulterFileFilter = (
  req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => void;

/** Filter for POST /gastos/upload (images and PDF). */
export const gastoFileFilter: MulterFileFilter = (_req, file, callback) => {
  if (!GASTO_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(
      new BadRequestException(
        'Tipo de archivo no permitido. Solo se aceptan imágenes o PDF.',
      ),
      false,
    );
    return;
  }

  callback(null, true);
};
