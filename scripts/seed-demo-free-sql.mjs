/* ============================================================
   Aplica scripts/seed-demo-free.sql sin necesitar el cliente psql.

   El fichero .sql usa metacomandos de psql (\if, :empresa) que solo
   entiende esa herramienta. Aqui se sustituye el id de la empresa, se
   quitan los metacomandos y se pasan las sentencias en una unica
   transaccion con el cliente de Prisma, que ya esta instalado.

   Uso:
     DATABASE_URL=... EMPRESA=13 node scripts/seed-demo-free-sql.mjs

   Sin DATABASE_URL se toma el del .env. Todas las sentencias van
   acotadas a esa empresa, asi que no tocan a ningun otro negocio.
============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');

const EMPRESA = Number(process.env.EMPRESA);
if (!Number.isInteger(EMPRESA) || EMPRESA <= 0) {
  console.error('Falta EMPRESA=<id de la empresa demo>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  const env = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
  const m = env.match(/^DATABASE_URL="?([^"\n]+)/m);
  if (!m) { console.error('No hay DATABASE_URL ni en el entorno ni en .env'); process.exit(1); }
  process.env.DATABASE_URL = m[1];
}

const sql = fs.readFileSync(path.join(aqui, 'seed-demo-free.sql'), 'utf8');

const sentencias = sql
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('\\') && !l.trimStart().startsWith('--'))
  .join('\n')
  .replaceAll(':empresa', String(EMPRESA))
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s && !/^(BEGIN|COMMIT)$/i.test(s));

const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    for (const s of sentencias) {
      const filas = await tx.$executeRawUnsafe(s);
      console.log(`${String(filas).padStart(5)} filas  ${s.split('\n')[0].slice(0, 62)}…`);
    }
  }, { timeout: 120000 });
  console.log('\nhistorico de la empresa', EMPRESA, 'ajustado');
} finally {
  await prisma.$disconnect();
}
