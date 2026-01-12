import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  controllers: [ServiceController],
  providers: [ServiceService, PrismaService, AccessControlService],
  exports: [ServiceService],
})
export class ServiceModule {}
