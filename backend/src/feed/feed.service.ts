import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecipeMapper, recipeSummaryInclude } from '../recipes/recipe.mapper';
import { ViewerFlagsService } from '../recipes/viewer-flags.service';
import { buildPage, cursorWhere, decodeCursor } from '../common/pagination';
import type { Page, RecipeSummary } from '@foodbook/shared';

const DISCOVER_WINDOW_DAYS = 30;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: RecipeMapper,
    private readonly viewerFlags: ViewerFlagsService,
  ) {}

  /** Cronologic, toate retetele. Scope-ul implicit din Etapa 1. */
  async all(viewerId: string, rawCursor: string | undefined, limit: number): Promise<Page<RecipeSummary>> {
    const rows = await this.prisma.recipe.findMany({
      where: { deletedAt: null, ...cursorWhere(decodeCursor(rawCursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: recipeSummaryInclude,
    });
    return this.toPage(rows, viewerId, limit);
  }

  /** Cronologic, doar autorii urmariti. Gol daca nu urmaresti pe nimeni. */
  async following(viewerId: string, rawCursor: string | undefined, limit: number): Promise<Page<RecipeSummary>> {
    const followedIds = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    if (followedIds.length === 0) return { items: [], nextCursor: null };

    const rows = await this.prisma.recipe.findMany({
      where: {
        deletedAt: null,
        userId: { in: followedIds.map((f) => f.followingId) },
        ...cursorWhere(decodeCursor(rawCursor)),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: recipeSummaryInclude,
    });
    return this.toPage(rows, viewerId, limit);
  }

  /**
   * scor = log(1 + likes*3 + comments*5 + saves*4) - ore_de_la_publicare / 12
   * (formula din plan, fara ML). Ordinea nu e stabila in timp - scorul se
   * schimba pe masura ce vin like-uri noi - deci paginam prin offset simplu,
   * nu prin cursor keyset (care nu are sens pe o ordine care nu e monotona).
   * Limitat la ultimele 30 de zile, ca sa nu scaneze intreg istoricul.
   */
  async discover(viewerId: string, rawOffset: string | undefined, limit: number): Promise<Page<RecipeSummary>> {
    const offset = rawOffset ? Number(Buffer.from(rawOffset, 'base64url').toString('utf8')) || 0 : 0;

    const ranked = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM recipes
      WHERE deleted_at IS NULL AND created_at > now() - interval '${Prisma.raw(String(DISCOVER_WINDOW_DAYS))} days'
      ORDER BY
        (ln(1 + likes_count * 3 + comments_count * 5 + saves_count * 4)
          - extract(epoch FROM (now() - created_at)) / 3600.0 / 12.0) DESC,
        id DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);

    const hasMore = ranked.length > limit;
    const idsInOrder = (hasMore ? ranked.slice(0, limit) : ranked).map((r) => r.id);
    if (idsInOrder.length === 0) return { items: [], nextCursor: null };

    const rows = await this.prisma.recipe.findMany({
      where: { id: { in: idsInOrder } },
      include: recipeSummaryInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = idsInOrder.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);

    const viewer = await this.viewerFlags.forRecipes(viewerId, idsInOrder);
    return {
      items: ordered.map((r) => this.mapper.toSummary(r, viewer)),
      nextCursor: hasMore ? Buffer.from(String(offset + limit)).toString('base64url') : null,
    };
  }

  private async toPage(
    rows: Prisma.RecipeGetPayload<{ include: typeof recipeSummaryInclude }>[],
    viewerId: string,
    limit: number,
  ): Promise<Page<RecipeSummary>> {
    const page = buildPage(rows, limit);
    const viewer = await this.viewerFlags.forRecipes(viewerId, page.items.map((r) => r.id));
    return { items: page.items.map((r) => this.mapper.toSummary(r, viewer)), nextCursor: page.nextCursor };
  }
}
