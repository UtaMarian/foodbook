import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { RecipesModule } from '../recipes/recipes.module';
import { UsersModule } from '../users/users.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [RecipesModule, UsersModule, SocialModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
