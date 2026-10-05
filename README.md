## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

//--prisma

Comandos seguros

Estos NO borran datos:

npx prisma db pull
npx prisma generate
npx prisma studio // abrir bd

---

--Comandos
rm node_modules -force
npm i
npx prisma migrate dev
npm run start:dev

# Generar cliente

npx prisma generate

// borrar la db

# Crear migración (elige un nombre descriptivo)

npx prisma migrate dev --name categories_i18n

# (Opcional) Ver el estado del DB

npx prisma studio

---

## License

---

## prisma

# Prisma ORM Setup

Este proyecto utiliza [Prisma](https://www.prisma.io/) como ORM para interactuar con la base de datos de forma sencilla, segura y tipada. Prisma funciona perfectamente con PostgreSQL, MySQL, SQLite, SQL Server y más.

---

## 📦 Requisitos

- Node.js v14 o superior
- Una base de datos (PostgreSQL, MySQL, SQLite, etc.)

---

## 🚀 Instalación

```bash
npm install prisma --save-dev
npm install @prisma/client
```

---

## 🧱 Inicialización

```bash
npx prisma init
```

Esto crea:

- `prisma/schema.prisma`: archivo donde defines tus modelos.
- `.env`: archivo con variables de entorno, incluyendo la URL de tu base de datos.

---

## 🧬 Migraciones

### Crear y aplicar una migración (modo desarrollo)

```bash
npx prisma migrate dev --name nombre_de_migracion
```

### Aplicar migraciones en producción

```bash
npx prisma migratenpx prisma migrate deploy
```

### Resetear la base de datos (borra todo y aplica migraciones desde cero)

```bash
npx prisma migrate reset
```

### Ver el estado de las migraciones

```bash
npx prisma migrate status
```

---

## 🧠 Sincronización con Base de Datos Existente

Si ya tienes una base de datos y quieres generar los modelos automáticamente:

```bash
npx prisma db pull
```

---

## 🚨 Aplicar cambios a la base de datos sin migraciones

```bash
npx prisma db push
```

> ⚠️ Úsalo solo en desarrollo. No genera archivos de migración.

---

## 📂 Generar el Cliente Prisma

```bash
npx prisma generate
```

Este comando es necesario cada vez que edites el archivo `schema.prisma`.

---

## 🔍 Interfaz visual: Prisma Studio

```bash
npx prisma studio
```

Abre una interfaz gráfica en el navegador para explorar y editar los datos de tu base de datos.

---

--iniciar session de nuevo
gh auth login

## 📄 Ejemplo de Modelo

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```

---

## 📚 Documentación útil

- Prisma Docs: [https://www.prisma.io/docs](https://www.prisma.io/docs)
- CLI Reference: [https://www.prisma.io/docs/reference/api-reference/command-reference](https://www.prisma.io/docs/reference/api-reference/command-reference)

---

## ✅ Buenas prácticas

- Ejecuta `npx prisma generate` después de cada cambio en el esquema.
- Usa `migrate dev` para mantener un historial de migraciones.
- No subas tu archivo `.env` al repositorio.
- Versiona siempre tu archivo `schema.prisma` y las migraciones (`prisma/migrations/`).

---

## 🧪 Consultas en código (ejemplo rápido)

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log(users);
}

main();
```

---

## gh auth login

npx prisma migrate dev
npx prisma db push
npx prisma generate
npx prisma studio - muetra la db ene le navegador

// se agrego role SELECT unnest(enum_range(NULL::"Role"));

ALTER TYPE "Role"
ADD VALUE 'EMPLOYEE';

---

## 🇪🇸 Festivos por comunidad autónoma (API externa)

España no tiene un único calendario de festivos: además de los nacionales
(iguales en todo el país), cada una de las 17 comunidades autónomas + Ceuta
y Melilla fija sus propios festivos (hasta 2 por año, de una bolsa
nacional), y algunos municipios suman los suyos propios encima. Por eso una
sede en Madrid, otra en Barcelona y otra en Bilbao pueden tener festivos
distintos el mismo año.

### Qué API se usa

**[calendariosnacionales.com](https://calendariosnacionales.com/es/api/)**
— API pública, gratuita, sin API key ni registro, licencia CC BY 4.0. Cubre
festivos nacionales, autonómicos, provinciales y locales de España, tomados
de fuentes oficiales (BOE + boletines autonómicos). Se actualiza cuando
sale un boletín oficial nuevo (normalmente octubre-noviembre del año
anterior).

> ⚠️ Sus términos de uso exigen **atribución con enlace visible** en la
> aplicación (algo como "Datos de festivos: Calendarios Nacionales" con
> link a su sitio) y piden no abusar de sincronizaciones — por eso acá los
> datos se traen una vez y se guardan localmente, no se consulta la API en
> cada reserva.

### Cómo funciona en este backend

1. **Modelo `Festivo`** (`prisma/schema.prisma`) — guarda cada festivo con
   `fecha`, `nombre`, `ambito` (`NACIONAL` / `AUTONOMICO` / `LOCAL`), `ccaa`
   y `municipio`. Es la única fuente que lee la app; nunca se llama a la
   API externa al servir `GET /festivos`.
2. **`Sede.ccaa`** — código de comunidad autónoma (ISO 3166-2:ES, ej.
   `MD`, `CT`, `PV`) de cada sede. Si no está cargado, se infiere
   automáticamente del `municipio`/`provincia` guardado
   (`src/data/festivo/ccaa-lookup.ts`) — así ninguna sede existente quedó
   sin festivos por no tener el campo nuevo cargado a mano.
3. **`GET /festivos?sedeId=X&anio=2026`** (público) — devuelve los
   festivos NACIONAL + los AUTONOMICO de la CCAA de esa sede + los LOCAL de
   su municipio. Son informativos: el calendario los pinta en rojo, pero
   **no bloquean** el agendado (eso lo hace `dias_cerrados_sede`, que es
   otro mecanismo aparte).
4. **`POST /festivos/sincronizar`** (solo `SUPER_ADMIN`, body
   `{ "anio": 2028 }`) — trae de la API externa los festivos NACIONAL +
   AUTONOMICO de las 19 comunidades/ciudades autónomas de España para ese
   año y los guarda (o actualiza) en la tabla `Festivo`. Hay que correrlo
   una vez por año, cuando salga el calendario oficial siguiente — no hay
   ningún cron corriendo solo. Los festivos **LOCAL** (ferias, patronos de
   cada municipio) no los trae este sync — son demasiados municipios para
   mapear uno por uno contra la API — esos se siguen cargando a mano en
   `SeedService.seedFestivos()`.

### Endpoints de la API externa que consume el sync

```
GET https://calendariosnacionales.com/es/v1/{año}/nacionales.json
GET https://calendariosnacionales.com/es/v1/{año}/regiones/{slug}.json
```

`{slug}` es el código de 3 letras que usa esa API (`and`, `mad`, `cat`,
`val`, `eus`, ...) — distinto del código ISO de 2 letras que usa este
proyecto (`AN`, `MD`, `CT`, `VC`, `PV`, ...). La conversión entre ambos
está en `CCAA_ISO_A_SLUG_EXTERNO`, dentro de
`src/data/festivo/festivo.service.ts`.

> Nota técnica: las llamadas a esa API fuerzan IPv4 (`family: 4`) porque en
> algunos entornos de desarrollo Windows la resolución DNS por IPv6 falla
> con `ENOTFOUND` aunque el dominio responda bien por IPv4.
