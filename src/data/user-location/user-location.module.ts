import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module'; // Asegúrate de que esta ruta sea correcta
import { UserLocationController } from './user-location.controller';
import { UserLocationService } from './user-location.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserLocationController],
  providers: [UserLocationService],
})
export class UserLocationModule {}
