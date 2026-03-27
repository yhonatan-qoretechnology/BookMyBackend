import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module'; // Asegúrate de que esta ruta sea correcta
import { UserCategoriesController } from './user-categories.controller';
import { UserCategoriesService } from './user-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserCategoriesController],
  providers: [UserCategoriesService], // PrismaService debe estar disponible
  // No necesitas exportar nada a menos que otros módulos vayan a inyectar UserCategoriesService
})
export class UserCategoriesModule {}
