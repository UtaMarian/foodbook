import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { cursorQuerySchema, type CursorQuery } from '@foodbook/shared';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
  ) {
    return this.notifications.list(user.id, query.cursor, query.limit);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post('read')
  @HttpCode(204)
  async markRead(@CurrentUser() user: RequestUser) {
    await this.notifications.markAllRead(user.id);
  }
}
