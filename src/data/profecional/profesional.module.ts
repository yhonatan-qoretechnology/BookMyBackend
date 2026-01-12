import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProfesionalController } from './profesional.controller';
import { ProfesionalService } from './profesional.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfesionalController],
  providers: [ProfesionalService, AccessControlService],
})
export class ProfesionalModule {}
