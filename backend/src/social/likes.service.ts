import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const P2002_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Idempotent: un al doilea "like" de la acelasi utilizator nu incrementeaza
   * contorul a doua oara - constrangerea unica (userId, recipeId) opreste
   * dublul insert la nivel de tranzactie, iar noi prindem eroarea specifica.
   */
  async like(userId: string, recipeId: string): Promise<{ likesCount: number }> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: { userId: true },
    });
    if (!recipe) throw new NotFoundException('Reteta inexistenta');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.recipeLike.create({ data: { userId, recipeId } });
        return tx.recipe.update({
          where: { id: recipeId },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        });
      });
      await this.notifications
        .notify({ userId: recipe.userId, actorId: userId, type: 'like', recipeId })
        .catch(() => undefined);
      return updated;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === P2002_UNIQUE_VIOLATION) {
        const current = await this.prisma.recipe.findUniqueOrThrow({
          where: { id: recipeId },
          select: { likesCount: true },
        });
        return current;
      }
      throw err;
    }
  }

  async unlike(userId: string, recipeId: string): Promise<{ likesCount: number }> {
    const deleted = await this.prisma.recipeLike
      .delete({ where: { userId_recipeId: { userId, recipeId } } })
      .catch(() => null);

    if (!deleted) {
      const current = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { likesCount: true },
      });
      if (!current) throw new NotFoundException('Reteta inexistenta');
      return current;
    }

    const updated = await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { likesCount: { decrement: 1 } },
      select: { likesCount: true },
    });
    return updated;
  }
}
