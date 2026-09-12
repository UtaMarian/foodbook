import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController, UserRecipesController } from './recipes.controller';
import { RecipeMapper } from './recipe.mapper';
import { ViewerFlagsService } from './viewer-flags.service';
import { CategoryLookupModule } from '../categories/category-lookup.module';

@Module({
  imports: [CategoryLookupModule],
  controllers: [RecipesController, UserRecipesController],
  providers: [RecipesService, RecipeMapper, ViewerFlagsService],
  exports: [RecipesService, RecipeMapper, ViewerFlagsService],
})
export class RecipesModule {}
