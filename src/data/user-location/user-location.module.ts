import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Asegúrate de que esta ruta sea correcta
import { UserLocationController } from './user-location.controller';
import { UserLocationService } from './user-location.service';

@Module({
  controllers: [UserLocationController],
  providers: [UserLocationService, PrismaService],
})
export class UserLocationModule {}
