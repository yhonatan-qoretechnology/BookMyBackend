import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { INSUMO_IMAGEN_EXTENSIONES } from './insumo-imagen.constants';

type MulterFileFilter = (
  req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => void;

/** Filtro de POST /stock/insumos/:id/imagenes: solo fotos. */
export const insumoImagenFilter: MulterFileFilter = (_req, file, callback) => {
  if (!INSUMO_IMAGEN_EXTENSIONES.has(file.mimetype)) {
    callback(
      new BadRequestException(
        'Formato no permitido. Solo se aceptan fotos JPG, PNG, WebP o GIF.',
      ),
      false,
    );
    return;
  }

  callback(null, true);
};

/**
 * El tipo de verdad de una foto ya subida, por sus primeros bytes, o null si
 * no es JPG, PNG, WebP ni GIF. El que trae la petición lo pone el cliente y
 * el filtro de arriba solo puede mirar ese; esto mira el contenido, para que
 * al espacio web no llegue nada que no sea una foto.
 */
export function tipoRealDeFoto(ruta: string): string | null {
  const cabecera = Buffer.alloc(12);
  const fd = fs.openSync(ruta, 'r');
  let leidos: number;
  try {
    leidos = fs.readSync(fd, cabecera, 0, cabecera.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  const bytes = cabecera.subarray(0, leidos);
  const texto = bytes.toString('latin1');

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (texto.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
  if (texto.startsWith('GIF87a') || texto.startsWith('GIF89a')) {
    return 'image/gif';
  }
  if (texto.startsWith('RIFF') && texto.slice(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
