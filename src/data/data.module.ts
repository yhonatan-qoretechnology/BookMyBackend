import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { GeographicService } from './geographic/geographic.service';
import { PersonalDocumentsService } from './geographic/personal-documents/personal-documents.service';

@Module({
  controllers: [DataController],
  providers: [DataService, GeographicService, PersonalDocumentsService],
  imports: [PrismaModule],
})
export class DataModule {}
