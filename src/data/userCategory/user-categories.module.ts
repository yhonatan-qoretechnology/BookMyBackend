import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Asegúrate de que esta ruta sea correcta
import { UserCategoriesController } from './user-categories.controller';
import { UserCategoriesService } from './user-categories.service';

@Module({
  controllers: [UserCategoriesController],
  providers: [UserCategoriesService, PrismaService], // PrismaService debe estar disponible
  // No necesitas exportar nada a menos que otros módulos vayan a inyectar UserCategoriesService
})
export class UserCategoriesModule {}
