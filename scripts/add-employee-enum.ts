import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addEmployeeToEnum() {
  try {
    console.log('📍 Agregando valor "employee" a enum ClientType...\n');

    await prisma.$executeRaw`
      ALTER TYPE "ClientType" ADD VALUE 'employee'
    `;

    console.log('✅ Valor "employee" agregado al enum ClientType\n');
    await prisma.$disconnect();
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  El valor "employee" ya existe en el enum\n');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
    await prisma.$disconnect();
  }
}

addEmployeeToEnum();
