import { Module } from '@nestjs/common';
import { AccessControlService } from '../../auth/services/access-control/access-control.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [PrismaModule],
  controllers: [BackupController],
  /* AccessControlService lo necesita RolesGuard: sin el, Nest no arranca. */
  providers: [BackupService, AccessControlService],
  exports: [BackupService],
})
export class BackupModule {}
