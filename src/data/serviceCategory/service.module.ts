import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceController],
  providers: [ServiceService, AccessControlService],
  exports: [ServiceService],
})
export class ServiceModule {}
