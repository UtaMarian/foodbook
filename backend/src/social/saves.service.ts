import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecipeMapper, recipeSummaryInclude } from '../recipes/recipe.mapper';
import { ViewerFlagsService } from '../recipes/viewer-flags.service';
import { decodeCursor, encodeCursor } from '../common/pagination';
import type { Page, RecipeSummary } from '@foodbook/shared';

const P2002_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class SavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: RecipeMapper,
    private readonly viewerFlags: ViewerFlagsService,
  ) {}

  async save(userId: string, recipeId: string): Promise<{ savesCount: number }> {
    const exists = await this.prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Reteta inexistenta');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.savedRecipe.create({ data: { userId, recipeId } });
        return tx.recipe.update({
          where: { id: recipeId },
          data: { savesCount: { increment: 1 } },
          select: { savesCount: true },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === P2002_UNIQUE_VIOLATION) {
        return this.prisma.recipe.findUniqueOrThrow({
          where: { id: recipeId },
          select: { savesCount: true },
        });
      }
      throw err;
    }
  }

  async unsave(userId: string, recipeId: string): Promise<{ savesCount: number }> {
    const deleted = await this.prisma.savedRecipe
      .delete({ where: { userId_recipeId: { userId, recipeId } } })
      .catch(() => null);

    if (!deleted) {
      const current = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { savesCount: true },
      });
      if (!current) throw new NotFoundException('Reteta inexistenta');
      return current;
    }

    return this.prisma.recipe.update({
      where: { id: recipeId },
      data: { savesCount: { decrement: 1 } },
      select: { savesCount: true },
    });
  }

  /**
   * Cursorul standard (createdAt, id) presupune un camp `id` pe randul
   * ordonat; SavedRecipe are cheie compusa (userId, recipeId), deci
   * construim filtrul manual, reutilizand doar encode/decode.
   */
  async listSaved(
    userId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<RecipeSummary>> {
    const cursor = decodeCursor(rawCursor);

    const rows = await this.prisma.savedRecipe.findMany({
      where: {
        userId,
        recipe: { deletedAt: null },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, recipeId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { recipeId: 'desc' }],
      take: limit + 1,
      include: { recipe: { include: recipeSummaryInclude } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    const viewer = await this.viewerFlags.forRecipes(
      userId,
      page.map((s) => s.recipeId),
    );

    return {
      items: page.map((s) => this.mapper.toSummary(s.recipe, viewer)),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.recipeId) : null,
    };
  }
}
