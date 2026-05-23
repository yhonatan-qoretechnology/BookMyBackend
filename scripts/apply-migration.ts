import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('📍 Aplicando migration a profesionales...\n');

    // 1. Agregar columna user_id
    console.log('  1️⃣  Agregando columna user_id...');
    await prisma.$executeRaw`
      ALTER TABLE "profesionales" ADD COLUMN IF NOT EXISTS "user_id" INTEGER UNIQUE
    `;
    console.log('     ✅ Columna agregada');

    // 2. Crear constraint FK
    console.log('  2️⃣  Agregando foreign key...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      console.log('     ✅ Foreign key creado');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('     ⚠️  Foreign key ya existe');
      } else {
        throw e;
      }
    }

    // 3. Crear índice
    console.log('  3️⃣  Creando índice...');
    try {
      await prisma.$executeRaw`
        CREATE INDEX "profesionales_user_id_idx" ON "profesionales"("user_id")
      `;
      console.log('     ✅ Índice creado');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('     ⚠️  Índice ya existe');
      } else {
        throw e;
      }
    }

    console.log('\n✨ Migration aplicada correctamente!\n');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

applyMigration();
