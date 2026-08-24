import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar mis notificaciones',
    description:
      'Requiere sesión. Devuelve las notificaciones del usuario autenticado, más recientes primero, con el conteo de no leídas.',
  })
  async findMine(
    @AuthUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationService.findForUser(user.userId, {
      onlyUnread: query.onlyUnread,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Conteo de notificaciones no leídas' })
  async unreadCount(@AuthUser() user: AuthenticatedUser) {
    const count = await this.notificationService.countUnread(user.userId);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.markAsRead(id, user.userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  async markAllAsRead(@AuthUser() user: AuthenticatedUser) {
    return this.notificationService.markAllAsRead(user.userId);
  }
}
