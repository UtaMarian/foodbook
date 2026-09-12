import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { MediaService } from '../uploads/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPage, cursorWhere, decodeCursor } from '../common/pagination';
import type { Comment as CommentDto, CreateCommentInput, Page } from '@foodbook/shared';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  private toDto(
    row: {
      id: string;
      recipeId: string;
      parentCommentId: string | null;
      content: string;
      createdAt: Date;
      author: { id: string; username: string; displayName: string; avatarKey: string | null; bio: string | null; recipesCount: number; followersCount: number; followingCount: number; createdAt: Date };
    },
    viewerId: string,
  ): CommentDto {
    return {
      id: row.id,
      recipeId: row.recipeId,
      parentCommentId: row.parentCommentId,
      content: row.content,
      author: {
        id: row.author.id,
        username: row.author.username,
        displayName: row.author.displayName,
        avatarUrl: this.media.url(row.author.avatarKey, 'thumb'),
        bio: row.author.bio,
        recipesCount: row.author.recipesCount,
        followersCount: row.author.followersCount,
        followingCount: row.author.followingCount,
        isFollowedByMe: false,
        createdAt: row.author.createdAt.toISOString(),
      },
      createdAt: row.createdAt.toISOString(),
      canDelete: row.author.id === viewerId,
    };
  }

  async list(recipeId: string, viewerId: string, rawCursor: string | undefined, limit: number): Promise<Page<CommentDto>> {
    const rows = await this.prisma.comment.findMany({
      where: { recipeId, deletedAt: null, ...cursorWhere(decodeCursor(rawCursor)) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { author: true },
    });

    const page = buildPage(rows, limit);
    return {
      items: page.items.map((r) => this.toDto(r, viewerId)),
      nextCursor: page.nextCursor,
    };
  }

  async create(recipeId: string, userId: string, input: CreateCommentInput): Promise<CommentDto> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: { userId: true },
    });
    if (!recipe) throw new NotFoundException('Reteta inexistenta');

    if (input.parentCommentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: input.parentCommentId, recipeId, deletedAt: null },
        select: { parentCommentId: true },
      });
      if (!parent) throw new BadRequestException('Comentariul parinte nu exista');
      // Limitam la un singur nivel de raspunsuri, ca sa nu ajungem la threading infinit in UI.
      if (parent.parentCommentId) {
        throw new BadRequestException('Nu poti raspunde la un raspuns');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          recipeId,
          userId,
          parentCommentId: input.parentCommentId ?? null,
          content: input.content,
        },
        include: { author: true },
      });
      await tx.recipe.update({ where: { id: recipeId }, data: { commentsCount: { increment: 1 } } });
      return comment;
    });

    await this.notifications
      .notify({ userId: recipe.userId, actorId: userId, type: 'comment', recipeId, commentId: created.id })
      .catch(() => undefined);

    return this.toDto(created, userId);
  }

  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { userId: true, recipeId: true },
    });
    if (!comment) throw new NotFoundException('Comentariu inexistent');
    if (comment.userId !== userId) throw new ForbiddenException('Nu poti sterge comentariul altcuiva');

    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      this.prisma.recipe.update({
        where: { id: comment.recipeId },
        data: { commentsCount: { decrement: 1 } },
      }),
    ]);
  }
}
