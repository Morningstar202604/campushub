import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

@Controller('notifications')
@ApiTags('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(@CurrentUser() user: AuthedUser, @Query('limit') limit?: string) {
    return this.notifications.list(user.sub, Number(limit) || 50);
  }

  @Get('unread-count')
  @UseGuards(AuthGuard)
  unreadCount(@CurrentUser() user: AuthedUser) {
    return this.notifications.unreadCount(user.sub);
  }

  @Patch('read-all')
  @UseGuards(AuthGuard)
  markAllRead(@CurrentUser() user: AuthedUser) {
    return this.notifications.markAllRead(user.sub);
  }
}
