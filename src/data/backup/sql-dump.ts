/* ============================================================
   Escritura de literales SQL para el volcado de Postgres.

   Está aparte del servicio porque es la parte que hay que mirar con lupa:
   una comilla mal escapada no rompe la copia —la deja restaurando datos
   equivocados, que es peor—.

   Todo asume `standard_conforming_strings = on` (lo normal desde Postgres
   9.1, y el volcado lo fija en su cabecera): dentro de una cadena, la
   barra invertida es un carácter más y la comilla se escapa doblándola.
============================================================ */

/** Nombre de tabla o columna: "lo que sea", con las comillas dobladas. */
export function ident(nombre: string): string {
  return `"${nombre.replace(/"/g, '""')}"`;
}

/** Cadena: 'lo que sea', con las comillas simples dobladas. */
export function texto(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

/**
 * Un valor tal y como lo devuelve el driver, convertido a literal SQL.
 *
 * `udt` es el tipo real de la columna en Postgres (`information_schema`),
 * y hace falta para dos cosas que no se pueden adivinar mirando el valor:
 * distinguir un `text[]` de un `jsonb` que contiene una lista, y saber a
 * qué tipo hay que convertir un array vacío.
 */
export function literal(valor: unknown, udt: string): string {
  if (valor === null || valor === undefined) return 'NULL';

  /* Arrays de Postgres: el tipo empieza por "_" ("_text" es text[]). */
  if (udt.startsWith('_')) {
    const base = udt.slice(1);
    const lista = Array.isArray(valor) ? valor : [valor];
    const elementos = lista.map((v) => literal(v, base)).join(', ');
    /* El cast no sobra en el array vacío: sin él Postgres no sabe de qué
       es ese ARRAY[] y la restauración falla. */
    return `ARRAY[${elementos}]::${ident(base)}[]`;
  }

  if (udt === 'json' || udt === 'jsonb') {
    return `${texto(JSON.stringify(valor))}::${udt}`;
  }

  if (valor instanceof Date) return texto(valor.toISOString());
  if (Buffer.isBuffer(valor)) return `'\\x${valor.toString('hex')}'::bytea`;
  if (typeof valor === 'boolean') return valor ? 'TRUE' : 'FALSE';
  if (typeof valor === 'bigint') return valor.toString();

  if (typeof valor === 'number') {
    /* NaN e Infinity son literales válidos en Postgres pero solo entre
       comillas; sin ellas, el archivo no se puede restaurar. */
    if (!Number.isFinite(valor)) return `'${valor === Infinity ? 'Infinity' : valor === -Infinity ? '-Infinity' : 'NaN'}'::${udt}`;
    return String(valor);
  }

  /* Un objeto en una columna que no es json no debería pasar, pero si
     pasa es mejor guardarlo como texto que escribir "[object Object]". */
  if (typeof valor === 'object') return texto(JSON.stringify(valor));

  return texto(String(valor));
}
