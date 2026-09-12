import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommentsService } from './comments.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createCommentSchema,
  cursorQuerySchema,
  type CreateCommentInput,
  type CursorQuery,
} from '@foodbook/shared';

@Controller('recipes/:id/comments')
export class RecipeCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
  ) {
    return this.comments.list(id, user.id, query.cursor, query.limit);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } }) // 60 comentarii/ora/utilizator
  @Post()
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.comments.create(id, user.id, body);
  }
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.comments.remove(id, user.id);
  }
}
