import { Controller, Get, Query } from '@nestjs/common';
import { FeedService } from './feed.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { feedQuerySchema, type FeedQuery } from '@foodbook/shared';

@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery,
  ) {
    switch (query.scope) {
      case 'following':
        return this.feed.following(user.id, query.cursor, query.limit);
      case 'discover':
        return this.feed.discover(user.id, query.cursor, query.limit);
      default:
        return this.feed.all(user.id, query.cursor, query.limit);
    }
  }
}
