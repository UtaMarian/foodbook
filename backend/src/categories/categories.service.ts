import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecipeMapper, recipeSummaryInclude } from '../recipes/recipe.mapper';
import { ViewerFlagsService } from '../recipes/viewer-flags.service';
import { buildPage, cursorWhere, decodeCursor } from '../common/pagination';
import { DEFAULT_CATEGORIES, type Category, type Page, type RecipeSummary } from '@foodbook/shared';

// resolveId (slug -> id, folosit la create/update reteta) traieste in
// CategoryLookupService, ca sa nu creeze o dependinta circulara cu RecipesModule.

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: RecipeMapper,
    private readonly viewerFlags: ViewerFlagsService,
  ) {}

  /**
   * Lista fixa se populeaza singura la pornire, doar pentru categoriile
   * care inca nu exista - nu suprascrie niciodata una existenta, ca un admin
   * sa poata redenumi/schimba emoji-ul unei categorii din panou fara ca
   * urmatorul restart al serverului sa ii anuleze modificarea.
   */
  async onModuleInit(): Promise<void> {
    for (const cat of DEFAULT_CATEGORIES) {
      await this.prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }
    this.logger.log(`Categorii sincronizate (${DEFAULT_CATEGORIES.length})`);
  }

  async list(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { recipes: { where: { deletedAt: null } } } } },
    });
    return rows.map((c) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      recipesCount: c._count.recipes,
    }));
  }

  async recipesBySlug(
    slug: string,
    viewerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<RecipeSummary>> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) throw new BadRequestException(`Categorie necunoscuta: ${slug}`);

    const rows = await this.prisma.recipe.findMany({
      where: { categoryId: category.id, deletedAt: null, ...cursorWhere(decodeCursor(rawCursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: recipeSummaryInclude,
    });

    const page = buildPage(rows, limit);
    const viewer = await this.viewerFlags.forRecipes(viewerId, page.items.map((r) => r.id));
    return {
      items: page.items.map((r) => this.mapper.toSummary(r, viewer)),
      nextCursor: page.nextCursor,
    };
  }
}
