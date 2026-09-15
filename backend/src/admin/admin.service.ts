import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Category as PrismaCategory, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TokensService } from '../auth/tokens.service';
import { buildPage, cursorWhere, decodeCursor } from '../common/pagination';
import type {
  AdminUserStatusFilter,
  AdminUserSummary,
  AppSettings,
  Category,
  CreateCategoryInput,
  Page,
  UpdateCategoryInput,
} from '@foodbook/shared';

const STATUS_TO_DB: Record<Exclude<AdminUserStatusFilter, 'all'>, UserStatus> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

/** Litere mici, fara diacritice, cuvinte unite prin cratima - la fel ca slug-urile existente. */
function stripDiacritics(text: string): string {
  const COMBINING_MARK_MIN = 0x0300;
  const COMBINING_MARK_MAX = 0x036f;
  return Array.from(text.normalize('NFD'))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_MARK_MIN || code > COMBINING_MARK_MAX;
    })
    .join('');
}

function slugify(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCategory(row: PrismaCategory & { _count?: { recipes: number } }): Category {
  return {
    slug: row.slug,
    name: row.name,
    emoji: row.emoji,
    recipesCount: row._count?.recipes ?? 0,
  };
}

function toSummary(user: User): AdminUserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role === 'ADMIN' ? 'admin' : 'user',
    status: user.status.toLowerCase() as AdminUserSummary['status'],
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly tokens: TokensService,
  ) {}

  async getSettings(): Promise<AppSettings> {
    return { requireApproval: await this.settings.getRequireApproval() };
  }

  async updateSettings(input: AppSettings): Promise<AppSettings> {
    await this.settings.setRequireApproval(input.requireApproval);
    return this.getSettings();
  }

  async listUsers(
    status: AdminUserStatusFilter,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<AdminUserSummary>> {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(status !== 'all' ? { status: STATUS_TO_DB[status] } : {}),
        ...cursorWhere(decodeCursor(rawCursor)),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const page = buildPage(rows, limit);
    return { items: page.items.map(toSummary), nextCursor: page.nextCursor };
  }

  async approve(id: string): Promise<AdminUserSummary> {
    const user = await this.setStatus(id, 'APPROVED');
    return toSummary(user);
  }

  async reject(id: string): Promise<AdminUserSummary> {
    const user = await this.setStatus(id, 'REJECTED');
    // Taie orice sesiune activa - un cont respins nu ar trebui sa mai
    // poata folosi un access token deja emis pana la expirarea lui naturala.
    await this.tokens.revokeAllForUser(id);
    return toSummary(user);
  }

  private async setStatus(id: string, status: UserStatus): Promise<User> {
    try {
      return await this.prisma.user.update({ where: { id }, data: { status } });
    } catch {
      throw new NotFoundException('Utilizator inexistent');
    }
  }

  async listCategories(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { recipes: { where: { deletedAt: null } } } } },
    });
    return rows.map(toCategory);
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const base = slugify(input.name);
    if (!base) throw new BadRequestException('Numele trebuie sa contina cel putin o litera sau cifra');

    let slug = base;
    for (let attempt = 2; await this.prisma.category.findUnique({ where: { slug } }); attempt++) {
      slug = `${base}-${attempt}`;
    }

    const row = await this.prisma.category.create({
      data: { slug, name: input.name.trim(), emoji: input.emoji },
    });
    return toCategory({ ...row, _count: { recipes: 0 } });
  }

  async updateCategory(slug: string, input: UpdateCategoryInput): Promise<Category> {
    try {
      const row = await this.prisma.category.update({
        where: { slug },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
        },
        include: { _count: { select: { recipes: { where: { deletedAt: null } } } } },
      });
      return toCategory(row);
    } catch {
      throw new NotFoundException('Categorie inexistenta');
    }
  }

  async deleteCategory(slug: string): Promise<void> {
    try {
      // onDelete: SetNull pe Recipe.category - retetele raman, doar isi pierd categoria.
      await this.prisma.category.delete({ where: { slug } });
    } catch {
      throw new NotFoundException('Categorie inexistenta');
    }
  }
}
