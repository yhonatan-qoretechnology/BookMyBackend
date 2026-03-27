import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ResenaController } from './resena.controller';
import { ResenaService } from './resena.service';

@Module({
  imports: [PrismaModule],
  controllers: [ResenaController],
  providers: [ResenaService],
})
export class ResenaModule {}
