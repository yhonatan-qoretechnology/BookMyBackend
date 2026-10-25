import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import { INSUMO_MAX_IMAGENES } from '../insumo-imagen.constants';

/** Distintivos que sabe pintar la tarjeta de la web. */
const ETIQUETAS_INSUMO = ['Nuevo', 'Top', 'Oferta'];

/**
 * Una foto es una URL http(s) completa o una ruta relativa uploads/... (las
 * que están en el disco de este servidor). Sin "..": con una ruta así se
 * podría apuntar, y luego borrar, un fichero fuera de uploads. Sin comillas,
 * paréntesis, <>, \ ni espacios: la web del negocio pone la foto en un
 * url("...") de CSS, y con ellos se podría cerrar y colar estilos detrás.
 */
const RUTA_IMAGEN_INSUMO =
  /^(?!.*\.\.)(https?:\/\/[^\s"'()<>\\]+|\/?uploads\/[^\s"'()<>\\]+)$/i;

const MAX_ESPECIFICACIONES = 20;
const MAX_LARGO_ESPECIFICACION = 120;

/**
 * La ficha técnica es una lista de pares [etiqueta, valor] de texto.
 * class-validator no sabe validar tuplas, de ahí este validador.
 */
function SonParesDeTexto(maxLargo: number) {
  return ValidateBy({
    name: 'sonParesDeTexto',
    validator: {
      validate: (valor: unknown) =>
        Array.isArray(valor) &&
        valor.every(
          (par: unknown) =>
            Array.isArray(par) &&
            par.length === 2 &&
            par.every(
              (texto: unknown) =>
                typeof texto === 'string' && texto.length <= maxLargo,
            ),
        ),
      defaultMessage: () =>
        `$property tiene que ser una lista de pares [etiqueta, valor], con textos de hasta ${maxLargo} caracteres.`,
    },
  });
}

/**
 * Alta de un insumo. ActualizarInsumoDto es esto mismo con todo opcional.
 *
 * El ValidationPipe global rechaza las claves que no estén aquí
 * (forbidNonWhitelisted): esta clase es la lista completa de lo que se puede
 * mandar, y el panel manda todo esto.
 */
export class CrearInsumoDto {
  @ApiProperty({ example: 'iPhone 18 Pro Max' })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({
    example: 'Móviles',
    description: 'Por defecto "General".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @ApiPropertyOptional({
    example: 'ud',
    description: 'Unidad de medida. Por defecto "ud".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unidad?: string;

  @ApiPropertyOptional({
    example: 1469,
    description:
      'Precio de referencia, en la moneda del país del negocio. En la web es el precio.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioRef?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Cuánto quiere tener el negocio en cada sede.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPorDefecto?: number;

  @ApiPropertyOptional({ example: true, description: 'false lo archiva.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    example: 14,
    description:
      'Solo SUPER_ADMIN: de qué negocio es. Una sesión de negocio usa siempre el suyo.',
  })
  @IsOptional()
  @IsInt()
  empresaId?: number;

  /* ── Catálogo web ───────────────────────────────────── */

  @ApiPropertyOptional({
    example: true,
    description:
      'Sale en la web del negocio (GET /catalogo-web/:empresaId). Por defecto no.',
  })
  @IsOptional()
  @IsBoolean()
  publicadoWeb?: boolean;

  @ApiPropertyOptional({ example: 'Tienda Apple', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  subcategoria?: string | null;

  @ApiPropertyOptional({ example: 'Apple', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marca?: string | null;

  @ApiPropertyOptional({
    enum: ETIQUETAS_INSUMO,
    nullable: true,
    description: 'Distintivo de la tarjeta. Vacío o null lo quita.',
  })
  @IsOptional()
  @IsIn([...ETIQUETAS_INSUMO, ''], {
    message: 'La etiqueta tiene que ser "Nuevo", "Top" u "Oferta", o ir vacía.',
  })
  etiqueta?: string | null;

  @ApiPropertyOptional({
    example: 'Pantalla 6,9", triple cámara 48 MP, chip A20 Pro.',
    nullable: true,
    description: 'Descripción corta, la de la tarjeta.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Descripción larga, la de la ficha del producto.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  descripcionLarga?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://bookmy.es/uploads/bookmy/insumos/14/foto.jpg'],
    description:
      'Fotos, la primera es la principal: sirve para reordenarlas o enlazar fotos de fuera. ' +
      'Para subir o quitar ficheros están POST y DELETE /stock/insumos/:id/imagenes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(INSUMO_MAX_IMAGENES, {
    message: `Un insumo puede tener como mucho ${INSUMO_MAX_IMAGENES} fotos.`,
  })
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @Matches(RUTA_IMAGEN_INSUMO, {
    each: true,
    message:
      'Cada foto tiene que ser una URL http(s) o una ruta uploads/..., sin espacios, comillas, paréntesis, <> ni \\.',
  })
  imagenes?: string[];

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    },
    example: [['Conectividad', '4G LTE · eSIM']],
    nullable: true,
    description: `Ficha técnica: hasta ${MAX_ESPECIFICACIONES} pares [etiqueta, valor].`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ESPECIFICACIONES, {
    message: `La ficha técnica admite como mucho ${MAX_ESPECIFICACIONES} filas.`,
  })
  @SonParesDeTexto(MAX_LARGO_ESPECIFICACION)
  especificaciones?: [string, string][] | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Con opciones de capacidad y color en la ficha (los móviles).',
  })
  @IsOptional()
  @IsBoolean()
  conVariantes?: boolean;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'Orden en la web, de menor a mayor. Sin orden, al final.',
  })
  @IsOptional()
  @IsInt({ message: 'El orden en la web tiene que ser un número entero.' })
  @Min(0, { message: 'El orden en la web no puede ser negativo.' })
  /* Lo que cabe en la columna (INTEGER): más allá, un 400 y no un 500. */
  @Max(2_147_483_647, { message: 'El orden en la web es demasiado grande.' })
  ordenWeb?: number | null;
}
