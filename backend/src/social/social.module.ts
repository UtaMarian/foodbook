import { Module } from '@nestjs/common';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';
import { SavesService } from './saves.service';
import { SavesController, SavedListController } from './saves.controller';
import { CommentsService } from './comments.service';
import { CommentsController, RecipeCommentsController } from './comments.controller';
import { FollowsService } from './follows.service';
import { FollowController, FollowListController } from './follows.controller';
import { RecipesModule } from '../recipes/recipes.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RecipesModule, UsersModule, NotificationsModule],
  controllers: [
    LikesController,
    SavesController,
    SavedListController,
    RecipeCommentsController,
    CommentsController,
    FollowController,
    FollowListController,
  ],
  providers: [LikesService, SavesService, CommentsService, FollowsService],
  exports: [FollowsService],
})
export class SocialModule {}
