import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLegacyProfessionals() {
  console.log('🌱 Iniciando seed de profesionales LEGACY (sin usuario)...\n');

  // Profesionales que servirán para pruebas de setup-credentials
  const legacyProfessionals = [
    {
      nombre: 'Pedro Sánchez',
      phone: '+34 700 111 111',
      biografia: 'Profesional de servicios generales',
      sedeId: 1,
    },
    {
      nombre: 'Laura Díaz',
      phone: '+34 700 222 222',
      biografia: 'Especialista en tratamientos premium',
      sedeId: 1,
    },
    {
      nombre: 'Roberto Gómez',
      phone: '+34 700 333 333',
      biografia: 'Profesional multidisciplinario',
      sedeId: 1,
    },
  ];

  for (const prof of legacyProfessionals) {
    try {
      // Verificar si ya existe
      const exists = await prisma.profesional.findUnique({
        where: { phone: prof.phone },
      });

      if (exists) {
        console.log(`⏭️  Profesional ${prof.nombre} ya existe, saltando...`);
        continue;
      }

      console.log(`📝 Creando profesional LEGACY: ${prof.nombre}`);
      console.log(`   Teléfono: ${prof.phone}`);
      console.log(`   ⚠️  Sin usuario (userId = NULL)`);

      // Crear profesional SIN usuario
      const profesional = await prisma.profesional.create({
        data: prof,
      });

      console.log(`✅ Profesional LEGACY creado con ID: ${profesional.id}`);
      console.log(`   Instrucción: Use endpoint PATCH /admin/profesionales/${profesional.id}/setup-credentials\n`);
    } catch (error) {
      console.error(`❌ Error creando profesional ${prof.nombre}:`, error);
    }
  }

  console.log('🎉 Seed de profesionales LEGACY completado!');
  console.log('\n📋 PROFESIONALES SIN USUARIO (para pruebas de setup):');
  console.log('='.repeat(60));

  const profesionales = await prisma.profesional.findMany({
    where: {
      phone: {
        in: legacyProfessionals.map((p) => p.phone),
      },
      userId: null,
    },
  });

  profesionales.forEach((prof) => {
    console.log(`\n👤 ${prof.nombre}`);
    console.log(`   ID: ${prof.id}`);
    console.log(`   Teléfono: ${prof.phone}`);
    console.log(`   Usuario: ❌ NO TIENE`);
    console.log(`   Endpoint para setup:`);
    console.log(`   PATCH /admin/profesionales/${prof.id}/setup-credentials`);
    console.log(`   Body: { "email": "nuevo@email.com", "password": "NuevaPass123!" }`);
  });

  console.log('\n' + '='.repeat(60) + '\n');
}

seedLegacyProfessionals()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
