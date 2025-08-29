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

--Comandos
rm node_modules -force
npm i
npx prisma migrate dev
npm run start:dev

# Generar cliente

npx prisma generate

// borrar la db 
npx prisma migrate reset

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
npx prisma migrate deploy
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
