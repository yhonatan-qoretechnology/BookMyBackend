import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ident, literal, texto } from './sql-dump';

/** Filas que se piden de golpe. Ni tan pocas que sean mil viajes a la base
 *  ni tantas que una tabla grande se cargue entera en memoria. */
const LOTE = 500;

/**
 * Copia de seguridad de la base.
 *
 * Dos formatos. El de verdad es SQL: un archivo que se restaura con `psql`
 * sobre un esquema ya creado. El JSON se mantiene para mirar los datos o
 * migrarlos a otro sitio, que es otra cosa.
 *
 * Se genera leyendo el propio esquema (`Prisma.dmmf`), no una lista escrita
 * a mano: una tabla nueva entra en la copia sin tocar este archivo, que es
 * justo lo que falla en los backups caseros —se añade un modelo y nadie se
 * acuerda de añadirlo aquí, y el fallo no se nota hasta que hay que
 * restaurar—.
 *
 * Va por lotes y en streaming: el controlador escribe cada trozo en la
 * respuesta según sale, así que la memoria no crece con la base.
 *
 * NO incluye los archivos subidos (fotos, documentos de verificación), que
 * viven en el SFTP; esto es la base de datos.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** `Users` -> `users`, `EmpresaKyc` -> `empresaKyc` (como los expone el cliente) */
  private delegado(modelo: string) {
    const clave = modelo.charAt(0).toLowerCase() + modelo.slice(1);
    const posible = (this.prisma as unknown as Record<string, unknown>)[clave];
    return typeof (posible as { findMany?: unknown })?.findMany === 'function'
      ? (posible as { findMany: (args?: unknown) => Promise<unknown[]> })
      : null;
  }

  /**
   * Qué va a tener la copia, sin generarla. El panel lo enseña antes de
   * descargar para que no sea un botón a ciegas.
   */
  async resumen() {
    const modelos = Prisma.dmmf.datamodel.models;
    const filas: Record<string, number> = {};
    let total = 0;

    for (const modelo of modelos) {
      const delegado = this.delegado(modelo.name);
      if (!delegado) continue;
      const n = await (
        delegado as unknown as { count: () => Promise<number> }
      ).count();
      filas[modelo.name] = n;
      total += n;
    }

    /* El tamaño en disco lo sabe Postgres; es orientativo porque el JSON
       ocupa más que las filas, pero da el orden de magnitud. */
    let tamanoBase: string | null = null;
    try {
      const r = await this.prisma.$queryRawUnsafe<{ t: string }[]>(
        'SELECT pg_size_pretty(pg_database_size(current_database())) AS t',
      );
      tamanoBase = r[0]?.t ?? null;
    } catch {
      tamanoBase = null;
    }

    return { tablas: Object.keys(filas).length, filas: total, detalle: filas, tamanoBase };
  }

  /* ── Volcado SQL ─────────────────────────────────────────── */

  /** Tablas reales del esquema public, incluida `_prisma_migrations`. */
  private async tablas(): Promise<string[]> {
    /* `relname` es de tipo `name` y Prisma no sabe leerlo en una
       consulta cruda: hay que pedirlo como texto. */
    const filas = await this.prisma.$queryRawUnsafe<{ tabla: string }[]>(`
      SELECT c.relname::text AS tabla
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);
    return filas.map((f) => f.tabla);
  }

  /** Columnas de una tabla con su tipo real, en el orden en que están. */
  private async columnas(tabla: string) {
    return this.prisma.$queryRawUnsafe<{ nombre: string; udt: string }[]>(
      `SELECT column_name::text AS nombre, udt_name::text AS udt
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      tabla,
    );
  }

  /**
   * Copia en SQL, restaurable con `psql`.
   *
   * Es un volcado SOLO DE DATOS: el esquema lo crean las migraciones de
   * Prisma, que viajan en el repositorio. Se dice en la cabecera del
   * propio archivo, con los dos comandos de la restauración, porque un
   * backup que no explica cómo se restaura no sirve de nada el día malo.
   *
   * No se usa `pg_dump`: el contenedor donde corre el backend no lleva las
   * herramientas de Postgres, así que el archivo se escribe aquí y
   * funciona en cualquier sitio donde arranque el servidor.
   */
  async *volcarSql(): AsyncGenerator<string> {
    const tablas = await this.tablas();
    const generado = new Date().toISOString();

    yield [
      '-- Copia de seguridad de Bookmy',
      `-- Generada: ${generado}`,
      `-- Tablas: ${tablas.length}`,
      '--',
      '-- SOLO DATOS. El esquema lo crean las migraciones de Prisma.',
      '-- Para restaurar sobre una base vacia:',
      '--   1) npx prisma migrate deploy',
      '--   2) psql "$DATABASE_URL" -f este-archivo.sql',
      '--',
      '-- Las claves ajenas se desactivan durante la carga, asi que el orden',
      '-- de las tablas da igual. Va todo en una transaccion: si algo falla,',
      '-- la base se queda como estaba.',
      '',
      'SET standard_conforming_strings = on;',
      "SET client_encoding = 'UTF8';",
      '',
      'BEGIN;',
      'SET CONSTRAINTS ALL DEFERRED;',
      "SET session_replication_role = 'replica';",
      '',
    ].join('\n');

    let totalFilas = 0;

    for (const tabla of tablas) {
      const columnas = await this.columnas(tabla);
      if (columnas.length === 0) continue;

      const listaColumnas = columnas.map((c) => ident(c.nombre)).join(', ');
      yield `
-- ${'-'.repeat(60)}
-- Tabla: ${tabla}
`;

      let saltar = 0;
      let filasTabla = 0;
      for (;;) {
        /* `ctid` existe en cualquier tabla y da un orden estable mientras
           dura el volcado: sin ORDER BY, el paginado puede repetir una
           fila y saltarse otra. */
        const lote = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM public.${ident(tabla)} ORDER BY ctid LIMIT ${LOTE} OFFSET ${saltar}`,
        );
        if (lote.length === 0) break;

        for (const fila of lote) {
          const valores = columnas.map((c) => literal(fila[c.nombre], c.udt)).join(', ');
          yield `INSERT INTO public.${ident(tabla)} (${listaColumnas}) VALUES (${valores});
`;
          filasTabla++;
        }

        if (lote.length < LOTE) break;
        saltar += LOTE;
      }

      if (filasTabla === 0) yield '-- (sin filas)\n';
      totalFilas += filasTabla;
    }

    /* Las secuencias: sin esto, el primer registro que se cree despues de
       restaurar choca con una clave que ya existe. */
    const secuencias = await this.prisma.$queryRawUnsafe<
      { tabla: string; columna: string; secuencia: string }[]
    >(`
      SELECT c.relname::text AS tabla, a.attname::text AS columna,
             pg_get_serial_sequence('public.' || quote_ident(c.relname), a.attname)::text AS secuencia
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND pg_get_serial_sequence('public.' || quote_ident(c.relname), a.attname) IS NOT NULL
      ORDER BY c.relname
    `);

    if (secuencias.length) {
      yield `
-- ${'-'.repeat(60)}
-- Secuencias
`;
      for (const s of secuencias) {
        const col = ident(s.columna);
        const tab = `public.${ident(s.tabla)}`;
        /* El tercer argumento a false deja la secuencia lista para
           devolver ese mismo numero: es lo correcto en una tabla vacia. */
        yield (
          `SELECT setval(${texto(s.secuencia)}, ` +
          `COALESCE((SELECT MAX(${col}) FROM ${tab}), 1), ` +
          `(SELECT COUNT(*) > 0 FROM ${tab}));
`
        );
      }
    }

    yield [
      '',
      "SET session_replication_role = 'origin';",
      'COMMIT;',
      '',
      `-- Fin de la copia: ${tablas.length} tablas, ${totalFilas} filas.`,
      '',
    ].join('\n');

    this.logger.log(`Copia SQL generada: ${tablas.length} tablas, ${totalFilas} filas`);
  }

  /**
   * El volcado, trozo a trozo. Sale un único JSON:
   *   { generadoEn, formato, tablas: { Modelo: [filas...] }, filas: {...} }
   */
  async *volcarJson(): AsyncGenerator<string> {
    const modelos = Prisma.dmmf.datamodel.models;
    const conteos: Record<string, number> = {};

    yield `{\n  "generadoEn": ${JSON.stringify(new Date().toISOString())},\n  "formato": 1,\n  "tablas": {`;

    let primeraTabla = true;
    for (const modelo of modelos) {
      const delegado = this.delegado(modelo.name);
      if (!delegado) continue;

      yield `${primeraTabla ? '\n' : ',\n'}    ${JSON.stringify(modelo.name)}: [`;
      primeraTabla = false;

      /* Ordenar por la clave hace que el paginado sea estable: sin un orden
         fijo, Postgres puede devolver la misma fila en dos lotes y saltarse
         otra. */
      const campoId = modelo.fields.find((f) => f.isId && f.kind === 'scalar');
      const orderBy = campoId ? { [campoId.name]: 'asc' } : undefined;

      let saltar = 0;
      let escritas = 0;
      for (;;) {
        const lote = (await delegado.findMany({
          take: LOTE,
          skip: saltar,
          ...(orderBy ? { orderBy } : {}),
        })) as unknown[];
        if (lote.length === 0) break;

        for (const fila of lote) {
          yield `${escritas === 0 ? '\n' : ',\n'}      ${JSON.stringify(fila)}`;
          escritas++;
        }

        if (lote.length < LOTE) break;
        saltar += LOTE;
      }

      conteos[modelo.name] = escritas;
      yield escritas ? '\n    ]' : ']';
    }

    yield `\n  },\n  "filas": ${JSON.stringify(conteos)}\n}\n`;

    const total = Object.values(conteos).reduce((a, b) => a + b, 0);
    this.logger.log(
      `Copia de seguridad generada: ${Object.keys(conteos).length} tablas, ${total} filas`,
    );
  }
}
