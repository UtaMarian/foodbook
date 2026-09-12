import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { LikesService } from './likes.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@Controller('recipes/:id/like')
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  // 200, nu 201: nu "creeaza o resursa", e o actiune idempotenta care intoarce
  // starea curenta - simetric cu DELETE de mai jos.
  @Post()
  @HttpCode(200)
  like(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.likes.like(user.id, id);
  }

  @Delete()
  @HttpCode(200)
  unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.likes.unlike(user.id, id);
  }
}
