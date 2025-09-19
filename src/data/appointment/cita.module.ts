import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CitaController } from './cita.controller';
import { CitaService } from './cita.service';

@Module({
  imports: [PrismaModule],
  controllers: [CitaController],
  providers: [CitaService],
})
export class CitaModule {}
