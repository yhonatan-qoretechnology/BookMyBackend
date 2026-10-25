import * as fs from 'fs';

/*
 * Carga el .env.local de desarrollo en process.env antes que nada. Tiene que
 * ser el primer import de main.ts (y de seed/cli.ts, que tambien usa Prisma).
 *
 * El cliente de Prisma, en cuanto alguien lo importa, mete el .env del repo
 * en process.env, y ConfigModule da prioridad a lo que ya esta en process.env
 * sobre sus ficheros. Sin esto, el envFilePath ['.env.local', '.env'] solo
 * valia para las variables que no estan en el .env: la DATABASE_URL, el
 * JWT_SECRET_KEY o el EMAIL_HOST seguian siendo los de PRODUCCION.
 *
 * Lo que venga del entorno sigue ganando: loadEnvFile no pisa variables ya
 * puestas. En el servidor no hay .env.local y esto no hace nada.
 */
const ENV_LOCAL = '.env.local';

if (fs.existsSync(ENV_LOCAL)) {
  process.loadEnvFile(ENV_LOCAL);
}
