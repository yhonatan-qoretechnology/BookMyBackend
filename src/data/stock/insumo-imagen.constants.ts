/**
 * Formatos de foto que acepta un insumo y la extensión con la que se guarda
 * cada uno. La extensión sale del tipo y no del nombre que trae el fichero:
 * las fotos se sirven tal cual desde /uploads, y un "foto.html" no puede
 * acabar sirviéndose como página.
 */
export const INSUMO_IMAGEN_EXTENSIONES = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

export const INSUMO_IMAGEN_MAX_BYTES = 10 * 1024 * 1024;

/** Fotos por subida (POST /stock/insumos/:id/imagenes). */
export const INSUMO_IMAGENES_POR_SUBIDA = 8;

/** Fotos que puede tener un insumo en total. */
export const INSUMO_MAX_IMAGENES = 12;

export const INSUMO_UPLOAD_TEMP_DIR = './uploads/insumos/temp';
