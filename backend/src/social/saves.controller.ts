import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { SavesService } from './saves.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { cursorQuerySchema, type CursorQuery } from '@foodbook/shared';

@Controller('recipes/:id/save')
export class SavesController {
  constructor(private readonly saves: SavesService) {}

  // 200, nu 201: simetric cu DELETE de mai jos, vezi likes.controller.ts.
  @Post()
  @HttpCode(200)
  save(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.saves.save(user.id, id);
  }

  @Delete()
  @HttpCode(200)
  unsave(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.saves.unsave(user.id, id);
  }
}

@Controller('me/saved')
export class SavedListController {
  constructor(private readonly saves: SavesService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
  ) {
    return this.saves.listSaved(user.id, query.cursor, query.limit);
  }
}
