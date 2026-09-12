import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { cursorQuerySchema, type CursorQuery } from '@foodbook/shared';

@Controller('users/:username/follow')
export class FollowController {
  constructor(private readonly follows: FollowsService) {}

  @Post()
  @HttpCode(204)
  async follow(@Param('username') username: string, @CurrentUser() user: RequestUser) {
    await this.follows.follow(user.id, username);
  }

  @Delete()
  @HttpCode(204)
  async unfollow(@Param('username') username: string, @CurrentUser() user: RequestUser) {
    await this.follows.unfollow(user.id, username);
  }
}

@Controller('users/:username')
export class FollowListController {
  constructor(private readonly follows: FollowsService) {}

  @Get('followers')
  followers(
    @Param('username') username: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
  ) {
    return this.follows.listFollowers(username, user.id, query.cursor, query.limit);
  }

  @Get('following')
  following(
    @Param('username') username: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
  ) {
    return this.follows.listFollowing(username, user.id, query.cursor, query.limit);
  }
}
