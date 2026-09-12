import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { MediaService } from '../uploads/media.service';
import { buildPage, cursorWhere, decodeCursor } from '../common/pagination';
import type { AppNotification, NotificationType, Page } from '@foodbook/shared';

interface CreateNotificationInput {
  userId: string;
  actorId: string;
  type: NotificationType;
  recipeId?: string;
  commentId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /**
   * Nu notificam un utilizator pentru propria lui actiune (like/comment pe
   * propria reteta). Esecul de a crea o notificare nu trebuie sa strice
   * actiunea principala - apelantul foloseste `.catch()` pe aceasta metoda.
   */
  async notify(input: CreateNotificationInput): Promise<void> {
    if (input.userId === input.actorId) return;
    await this.prisma.notification.create({ data: input });
  }

  async list(userId: string, rawCursor: string | undefined, limit: number): Promise<Page<AppNotification>> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...cursorWhere(decodeCursor(rawCursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        actor: { select: { id: true, username: true, displayName: true, avatarKey: true } },
        recipe: { select: { title: true } },
      },
    });

    const page = buildPage(rows, limit);
    return {
      items: page.items.map((n) => ({
        id: n.id,
        type: n.type as NotificationType,
        actor: {
          id: n.actor.id,
          username: n.actor.username,
          displayName: n.actor.displayName,
          avatarUrl: this.media.url(n.actor.avatarKey, 'thumb'),
        },
        recipeId: n.recipeId,
        recipeTitle: n.recipe?.title ?? null,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
