import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/*
 * Lo que se sube acaba servido desde el espacio web (bookmy.es). Los
 * servicios arman el nombre con la extensión que manda el cliente
 * (`file.originalname`) y los filtros de multer miran el `mimetype`, que
 * también lo pone él: un `x.html` declarado como image/png llegaba al
 * dominio tal cual, y con él un XSS almacenado o, si el hosting ejecuta PHP,
 * algo peor. Aquí se mira el contenido de verdad, en el único sitio por el
 * que pasan todas las subidas a producción.
 */

type Familia = 'imagen' | 'pdf' | 'word' | 'audio';

const EXTENSIONES: Record<Familia, string[]> = {
  /* Una imagen vale con cualquier extensión de imagen: el compresor del
     chat puede re-codificar sin tocar el nombre. */
  imagen: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  pdf: ['.pdf'],
  word: ['.doc', '.docx'],
  audio: ['.webm', '.weba', '.ogg', '.oga', '.opus', '.mp3', '.m4a', '.mp4', '.aac', '.wav'],
};

/** La familia del archivo por sus primeros bytes, o null si no es ninguna. */
function familiaReal(ruta: string): Familia | null {
  const cabecera = Buffer.alloc(16);
  const fd = fs.openSync(ruta, 'r');
  let leidos: number;
  try {
    leidos = fs.readSync(fd, cabecera, 0, cabecera.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  const b = cabecera.subarray(0, leidos);
  const t = b.toString('latin1');

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'imagen';
  if (t.startsWith('\x89PNG\r\n\x1a\n')) return 'imagen';
  if (t.startsWith('GIF87a') || t.startsWith('GIF89a')) return 'imagen';
  if (t.startsWith('RIFF') && t.slice(8, 12) === 'WEBP') return 'imagen';

  if (t.startsWith('%PDF-')) return 'pdf';

  // .doc (OLE2) y .docx (ZIP)
  if (b.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) {
    return 'word';
  }
  if (t.startsWith('PK\x03\x04')) return 'word';

  if (b.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))) return 'audio'; // webm
  if (t.startsWith('OggS')) return 'audio';
  if (t.startsWith('ID3')) return 'audio'; // mp3 con etiquetas
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio'; // mp3 / aac
  if (t.slice(4, 8) === 'ftyp') return 'audio'; // m4a / mp4
  if (t.startsWith('RIFF') && t.slice(8, 12) === 'WAVE') return 'audio';

  return null;
}

/**
 * Lanza 400 si el archivo no es una imagen, PDF, Word o audio de verdad, o si
 * la extensión con la que se va a publicar no corresponde a lo que es.
 */
export function asegurarArchivoSeguro(
  rutaLocal: string,
  rutaPublicada: string,
): void {
  const familia = familiaReal(rutaLocal);
  if (!familia) {
    throw new BadRequestException(
      'Tipo de archivo no permitido. Solo se aceptan imágenes, PDF, Word o audio.',
    );
  }

  const extension = path.extname(rutaPublicada).toLowerCase();
  if (extension && !EXTENSIONES[familia].includes(extension)) {
    throw new BadRequestException(
      'La extensión del archivo no corresponde a su contenido.',
    );
  }
}
