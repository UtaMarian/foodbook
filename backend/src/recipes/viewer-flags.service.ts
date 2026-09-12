import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { noViewerFlags, type ViewerFlags } from './recipe.mapper';

/**
 * Calculeaza "am dat like / am salvat?" pentru o pagina de retete, cu doua
 * query-uri in plus TOTAL (nu per rand): un IN pe likes, un IN pe saves.
 *
 * Traieste in recipes/ (nu social/) desi opereaza pe date "sociale") ca sa
 * evite un ciclu de dependinte: SocialModule are nevoie de RecipeMapper din
 * RecipesModule, iar RecipesModule are nevoie de acest serviciu pentru
 * findOne/listByUsername. Un singur sens: SocialModule -> RecipesModule.
 */
@Injectable()
export class ViewerFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async forRecipes(userId: string | null, recipeIds: string[]): Promise<ViewerFlags> {
    if (!userId || recipeIds.length === 0) return noViewerFlags;

    const [likes, saves] = await Promise.all([
      this.prisma.recipeLike.findMany({
        where: { userId, recipeId: { in: recipeIds } },
        select: { recipeId: true },
      }),
      this.prisma.savedRecipe.findMany({
        where: { userId, recipeId: { in: recipeIds } },
        select: { recipeId: true },
      }),
    ]);

    return {
      likedIds: new Set(likes.map((l) => l.recipeId)),
      savedIds: new Set(saves.map((s) => s.recipeId)),
    };
  }

  async forRecipe(userId: string | null, recipeId: string): Promise<ViewerFlags> {
    return this.forRecipes(userId, [recipeId]);
  }
}
