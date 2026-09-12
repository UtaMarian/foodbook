import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { FollowsService } from '../social/follows.service';
import { RecipeMapper, recipeSummaryInclude } from '../recipes/recipe.mapper';
import { ViewerFlagsService } from '../recipes/viewer-flags.service';
import { decodeCursor, encodeCursor } from '../common/pagination';
import type { Page, PublicUser, RecipeSummary } from '@foodbook/shared';

/**
 * Cautare cu ILIKE + unaccent, nu tsvector/GIN: la volumul asteptat (cateva
 * mii de retete) un secvential scan e suficient de rapid, iar modelarea unei
 * coloane generate tsvector in Prisma (Unsupported + index Gin) e fragila si
 * risca drift la migratii viitoare. Devine o optimizare de luat in calcul
 * cand tabelul creste mult - Prisma nu stie sa apeleze unaccent() din
 * query builder-ul obisnuit, de aceea filtrarea e in SQL brut, parametrizat.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: RecipeMapper,
    private readonly viewerFlags: ViewerFlagsService,
    private readonly usersService: UsersService,
    private readonly follows: FollowsService,
  ) {}

  async recipes(
    query: string,
    viewerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<RecipeSummary>> {
    const q = query.trim();
    if (!q) return { items: [], nextCursor: null };
    const pattern = `%${q}%`;
    const cursor = decodeCursor(rawCursor);

    const matches = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>(Prisma.sql`
      SELECT id, created_at FROM recipes
      WHERE deleted_at IS NULL
        AND (
          unaccent(lower(coalesce(title, ''))) LIKE unaccent(lower(${pattern}))
          OR unaccent(lower(coalesce(description, ''))) LIKE unaccent(lower(${pattern}))
        )
        ${
          cursor
            ? Prisma.sql`AND (created_at < ${cursor.createdAt} OR (created_at = ${cursor.createdAt} AND id < ${cursor.id}))`
            : Prisma.empty
        }
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `);

    const hasMore = matches.length > limit;
    const page = hasMore ? matches.slice(0, limit) : matches;
    const last = page[page.length - 1];
    if (page.length === 0) return { items: [], nextCursor: null };

    const rows = await this.prisma.recipe.findMany({
      where: { id: { in: page.map((m) => m.id) } },
      include: recipeSummaryInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = page.map((m) => byId.get(m.id)).filter((r): r is NonNullable<typeof r> => !!r);

    const viewer = await this.viewerFlags.forRecipes(viewerId, page.map((m) => m.id));
    return {
      items: ordered.map((r) => this.mapper.toSummary(r, viewer)),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    };
  }

  async users(
    query: string,
    viewerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<PublicUser>> {
    const q = query.trim();
    if (!q) return { items: [], nextCursor: null };
    const pattern = `%${q}%`;
    const cursor = decodeCursor(rawCursor);

    const matches = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>(Prisma.sql`
      SELECT id, created_at FROM users
      WHERE (
        unaccent(lower(username)) LIKE unaccent(lower(${pattern}))
        OR unaccent(lower(display_name)) LIKE unaccent(lower(${pattern}))
      )
      ${
        cursor
          ? Prisma.sql`AND (created_at < ${cursor.createdAt} OR (created_at = ${cursor.createdAt} AND id < ${cursor.id}))`
          : Prisma.empty
      }
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `);

    const hasMore = matches.length > limit;
    const page = hasMore ? matches.slice(0, limit) : matches;
    const last = page[page.length - 1];
    if (page.length === 0) return { items: [], nextCursor: null };

    const rows = await this.prisma.user.findMany({ where: { id: { in: page.map((m) => m.id) } } });
    const byId = new Map(rows.map((u) => [u.id, u]));
    const ordered = page.map((m) => byId.get(m.id)).filter((u): u is NonNullable<typeof u> => !!u);
    const myFollowing = await this.follows.myFollowingSet(viewerId);

    return {
      items: ordered.map((u) => this.usersService.toPublicUser(u, myFollowing.has(u.id))),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    };
  }
}
