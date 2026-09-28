/* ============================================================
   Borra por completo una empresa de demostracion y todo lo suyo.

   Pensado para deshacer scripts/seed-demo-free.mjs. Va en el orden que
   exigen las claves ajenas (casi todas son RESTRICT) y dentro de una
   unica transaccion: o se va todo, o no se toca nada.

   Solo borra usuarios que no tengan rastro fuera de esta empresa: si un
   cliente de la demo ha reservado tambien en otro negocio, se queda.

   Uso:
     DATABASE_URL=... EMPRESA=13 node scripts/borrar-empresa-demo.mjs        # ensaya
     DATABASE_URL=... EMPRESA=13 BORRAR=si node scripts/borrar-empresa-demo.mjs

   Sin BORRAR=si solo cuenta lo que se llevaria por delante.
============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EMPRESA = Number(process.env.EMPRESA);
if (!Number.isInteger(EMPRESA) || EMPRESA <= 0) {
  console.error('Falta EMPRESA=<id de la empresa a borrar>');
  process.exit(1);
}
const DE_VERDAD = process.env.BORRAR === 'si';

if (!process.env.DATABASE_URL) {
  const env = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
  process.env.DATABASE_URL = env.match(/^DATABASE_URL="?([^"\n]+)/m)?.[1];
}

const prisma = new PrismaClient();
const uno = async (sql) => (await prisma.$queryRawUnsafe(sql))[0];

const empresa = await uno(`SELECT id, nombre FROM empresas WHERE id = ${EMPRESA}`);
if (!empresa) { console.error(`No existe la empresa ${EMPRESA}`); process.exit(1); }

/* Conjuntos de la empresa, como subconsultas reutilizables. */
const SEDES = `(SELECT id FROM sedes WHERE "empresaId" = ${EMPRESA})`;
const PROFES = `(SELECT id FROM profesionales WHERE "sedeId" IN ${SEDES})`;
const CITAS = `(SELECT id FROM "Appointment" WHERE "sedeId" IN ${SEDES})`;
/* Servicios que SOLO se ofrecen en sedes de esta empresa. */
const SERVICIOS = `(
  SELECT sv.id FROM servicios sv
   WHERE EXISTS (SELECT 1 FROM "_SedeServicios" ss WHERE ss."B" = sv.id AND ss."A" IN ${SEDES})
     AND NOT EXISTS (SELECT 1 FROM "_SedeServicios" ss WHERE ss."B" = sv.id AND ss."A" NOT IN ${SEDES})
)`;
/* Usuarios cuyo unico rastro es esta empresa: el dueno y los clientes demo.
   Se resuelve AHORA y se guarda la lista de ids: los primeros pasos borran
   las citas, que es justo por donde se reconoce a un cliente de la demo. Si
   se dejara como subconsulta, al llegar al final ya no encontraria a nadie. */
const { rows: usuariosDemo } = {
  rows: await prisma.$queryRawUnsafe(`
    SELECT u.id FROM users u
     WHERE (u.id IN (SELECT user_id FROM admin_profiles WHERE empresa_id = ${EMPRESA})
            OR u.id IN (SELECT "userId" FROM "Appointment" WHERE "sedeId" IN ${SEDES}))
       AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."userId" = u.id AND a."sedeId" NOT IN ${SEDES})
       AND NOT EXISTS (SELECT 1 FROM admin_profiles ap WHERE ap.user_id = u.id AND (ap.empresa_id IS NULL OR ap.empresa_id <> ${EMPRESA}))
       AND NOT EXISTS (SELECT 1 FROM profesionales p WHERE p.user_id = u.id AND p."sedeId" NOT IN ${SEDES})
  `),
};
/* `IN (NULL)` no casa con nada, que es lo que queremos si no hay ninguno. */
const USUARIOS = usuariosDemo.length
  ? `(${usuariosDemo.map((u) => u.id).join(',')})`
  : '(NULL)';

/* En orden: primero las hojas, al final la empresa. */
const PASOS = [
  ['pagos',                  `DELETE FROM payments WHERE "appointmentId" IN ${CITAS}`],
  ['historial de citas',     `DELETE FROM appointment_history WHERE "appointmentId" IN ${CITAS}`],
  ['citas',                  `DELETE FROM "Appointment" WHERE "sedeId" IN ${SEDES}`],
  ['resenas',                `DELETE FROM resenas WHERE "sedeId" IN ${SEDES}`],
  ['vistas del catalogo',    `DELETE FROM entity_views WHERE empresa_id = ${EMPRESA} OR sede_id IN ${SEDES}`],
  ['servicio-sede-profesional', `DELETE FROM service_sede_profesional WHERE "sedeId" IN ${SEDES}`],
  ['disponibilidad',         `DELETE FROM disponibilidad_profesional WHERE "profesionalId" IN ${PROFES}`],
  ['profesionales',          `DELETE FROM profesionales WHERE "sedeId" IN ${SEDES}`],
  ['horarios de sede',       `DELETE FROM horario_sede WHERE "sedeId" IN ${SEDES}`],
  ['dias cerrados',          `DELETE FROM dias_cerrados_sede WHERE "sedeId" IN ${SEDES}`],
  ['galerias',               `DELETE FROM galerias WHERE "sedeId" IN ${SEDES}`],
  ['gastos',                 `DELETE FROM gastos WHERE "sedeId" IN ${SEDES}`],
  ['categorias de gasto',    `DELETE FROM categorias_gasto WHERE "empresaId" = ${EMPRESA}`],
  ['precios de servicio',    `DELETE FROM "Price" WHERE "serviceId" IN ${SERVICIOS}`],
  ['traducciones de servicio', `DELETE FROM "ServiceTranslation" WHERE "serviceId" IN ${SERVICIOS}`],
  ['servicios',              `DELETE FROM servicios WHERE id IN ${SERVICIOS}`],
  ['tarjetas guardadas',     `DELETE FROM payment_cards WHERE user_id IN ${USUARIOS}`],
  ['categorias de usuario',  `DELETE FROM user_category WHERE user_id IN ${USUARIOS}`],
  ['fichas de usuario',      `DELETE FROM user_data WHERE user_id IN ${USUARIOS}`],
  ['credenciales',           `DELETE FROM user_auth WHERE user_id IN ${USUARIOS}`],
  ['perfiles de admin',      `DELETE FROM admin_profiles WHERE empresa_id = ${EMPRESA} OR user_id IN ${USUARIOS}`],
  ['usuarios',               `DELETE FROM users WHERE id IN ${USUARIOS}`],
  ['sedes',                  `DELETE FROM sedes WHERE "empresaId" = ${EMPRESA}`],
  ['empresa',                `DELETE FROM empresas WHERE id = ${EMPRESA}`],
];

console.log(`empresa ${empresa.id}: ${empresa.nombre}`);
console.log(DE_VERDAD ? '>> BORRANDO DE VERDAD\n' : '>> solo ensayo (pasa BORRAR=si para borrar)\n');

if (!DE_VERDAD) {
  for (const [que, sql] of PASOS) {
    const cuenta = sql.replace(/^DELETE FROM ("?\w+"?)/, 'SELECT count(*)::int AS n FROM $1');
    const { n } = await uno(cuenta);
    if (n) console.log(String(n).padStart(6), que);
  }
  console.log('\nnada se ha tocado');
} else {
  await prisma.$transaction(async (tx) => {
    for (const [que, sql] of PASOS) {
      const n = await tx.$executeRawUnsafe(sql);
      if (n) console.log(String(n).padStart(6), que);
    }
  }, { timeout: 120000 });
  console.log('\nempresa', EMPRESA, 'borrada por completo');
}

await prisma.$disconnect();
