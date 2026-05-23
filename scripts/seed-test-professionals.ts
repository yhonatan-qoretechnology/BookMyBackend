import { PrismaClient, ClientType, ClientState, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedTestProfessionals() {
  console.log('🌱 Iniciando seed de profesionales de prueba...\n');

  const testProfessionals = [
    { nombre: 'Juan García', phone: '+34 600 111 111', sedeId: 1 },
    { nombre: 'María López', phone: '+34 600 222 222', sedeId: 1 },
    { nombre: 'Carlos Martínez', phone: '+34 600 333 333', sedeId: 1 },
    { nombre: 'Ana Rodríguez', phone: '+34 600 444 444', sedeId: 1 },
    { nombre: 'Miguel Fernández', phone: '+34 600 555 555', sedeId: 1 },
  ];

  const hashedPassword = await bcrypt.hash('employee2024*', 10);

  for (const prof of testProfessionals) {
    try {
      const exists = await prisma.profesional.findUnique({
        where: { phone: prof.phone },
      });

      if (exists) {
        console.log(`⏭️  ${prof.nombre} ya existe`);
        continue;
      }

      const phoneClean = prof.phone.replace(/\s+/g, '');
      const email = `${phoneClean}@${prof.nombre.replace(/\s+/g, '').toLowerCase()}.com`;

      // 1. Crear User
      const user = await prisma.users.create({
        data: {
          email,
          clientType: ClientType.employee,
          role: Role.EMPLOYEE,
          state: ClientState.enabled,
          UserAuth: {
            create: { email, password: hashedPassword },
          },
          UserData: {
            create: {
              name: prof.nombre,
              phone: prof.phone,
              email,
              countryId: 1,
              idioma: 'es',
              gender: 'No especificado',
            },
          },
        },
      });

      // 2. Crear Profesional y vincular User
      const profesional = await prisma.profesional.create({
        data: {
          nombre: prof.nombre,
          phone: prof.phone,
          sedeId: prof.sedeId,
          userId: user.id,
          biografia: 'Profesional del sistema',
        },
        include: { user: true },
      });

      console.log(`✅ ${prof.nombre} - Email: ${email}`);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        console.log(`⏭️  ${prof.nombre} - Duplicado`);
      } else {
        console.error(`❌ ${prof.nombre}:`, error?.message);
      }
    }
  }

  console.log('\n📋 CREDENCIALES:');
  console.log('='.repeat(70));

  const profesionales = await prisma.profesional.findMany({
    where: {
      phone: { in: testProfessionals.map((p) => p.phone) },
      user: { isNot: null },
    },
    include: { user: true },
  });

  profesionales.forEach((prof) => {
    console.log(
      `👤 ${prof.nombre} | Email: ${prof.user?.email} | Pass: employee2024*`,
    );
  });

  console.log('='.repeat(70) + '\n');
  await prisma.$disconnect();
}

seedTestProfessionals().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
