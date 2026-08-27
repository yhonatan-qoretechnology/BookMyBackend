import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationGatewayService } from './notification-gateway.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { SocketAuthModule } from '../../auth/socket/socket-auth.module';

@Module({
  imports: [SocketAuthModule, PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway, NotificationGatewayService],
  exports: [NotificationService],
})
export class NotificationModule {}
