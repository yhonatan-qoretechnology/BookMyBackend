import { Module } from '@nestjs/common';
import { AccessControlService } from 'src/auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ResenaController } from './resena.controller';
import { ResenaService } from './resena.service';

@Module({
  imports: [PrismaModule],
  controllers: [ResenaController],
  /* RolesGuard inyecta AccessControlService, y el guard se resuelve
     en el contexto del modulo que declara el controlador: sin esto,
     proteger el borrado tumba el arranque de la aplicacion. */
  providers: [ResenaService, AccessControlService],
})
export class ResenaModule {}
