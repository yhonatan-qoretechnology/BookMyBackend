import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProfesionalController } from './profesional.controller';
import { ProfesionalService } from './profesional.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfesionalController],
  providers: [ProfesionalService],
})
export class ProfesionalModule {}
