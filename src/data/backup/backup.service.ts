import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/** Filas que se piden de golpe. Ni tan pocas que sean mil viajes a la base
 *  ni tantas que una tabla grande se cargue entera en memoria. */
const LOTE = 500;

/**
 * Copia de seguridad de la base en JSON.
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

  /**
   * El volcado, trozo a trozo. Sale un único JSON:
   *   { generadoEn, formato, tablas: { Modelo: [filas...] }, filas: {...} }
   */
  async *volcar(): AsyncGenerator<string> {
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
