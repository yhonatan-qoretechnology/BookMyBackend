import { PrismaService } from 'src/prisma/prisma.service';
import { SeedService } from './seed.service';

const prisma = new PrismaService();
const seedService = new SeedService(prisma);

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  console.log('🌱 Ejecutando seed CLI...\n');

  switch (command) {
    case 'empresas':
      await seedService.seedEmpresas();
      break;
    case 'super-admin':
      await seedService.seedSuperAdmin();
      break;
    case 'company-admin':
      await seedService.seedCompanyAdmin();
      break;
    case 'branch-admin':
      await seedService.seedBranchAdmin();
      break;
    case 'categories':
      await seedService.seedCategories();
      break;
    case 'sedes':
      await seedService.seedSedes();
      break;
    case 'profesionales':
      await seedService.seedProfesionales();
      break;
    case 'services':
      await seedService.seedServices();
      break;
    case 'all':
      console.log('Ejecutando todos los seeds...');
      await seedService.seedEmpresas();
      await seedService.seedSuperAdmin();
      await seedService.seedCategories();
      await seedService.seedSedes();
      await seedService.seedProfesionales();
      await seedService.seedServices();
      await seedService.seedServiceSedeProfesional();
      console.log('✅ Todos los seeds completados');
      break;
    default:
      console.log('Comandos disponibles:');
      console.log('  npm run seed -- empresas');
      console.log('  npm run seed -- super-admin');
      console.log('  npm run seed -- company-admin');
      console.log('  npm run seed -- branch-admin');
      console.log('  npm run seed -- categories');
      console.log('  npm run seed -- sedes');
      console.log('  npm run seed -- profesionales');
      console.log('  npm run seed -- services');
      console.log('  npm run seed -- all');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
