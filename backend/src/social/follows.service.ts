import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { decodeCursor, encodeCursor } from '../common/pagination';
import type { Page, PublicUser } from '@foodbook/shared';

const P2002_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  private async findUserOrThrow(username: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Utilizator inexistent');
    return user;
  }

  async follow(followerId: string, targetUsername: string): Promise<void> {
    const target = await this.findUserOrThrow(targetUsername);
    if (target.id === followerId) {
      throw new BadRequestException('Nu te poti urmari pe tine insuti');
    }

    try {
      await this.prisma.$transaction([
        this.prisma.follow.create({ data: { followerId, followingId: target.id } }),
        this.prisma.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        }),
        this.prisma.user.update({
          where: { id: target.id },
          data: { followersCount: { increment: 1 } },
        }),
      ]);
    } catch (err) {
      // Deja il urmaresti - idempotent, nu e o eroare.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === P2002_UNIQUE_VIOLATION) {
        return;
      }
      throw err;
    }

    await this.notifications
      .notify({ userId: target.id, actorId: followerId, type: 'follow' })
      .catch(() => undefined);
  }

  async unfollow(followerId: string, targetUsername: string): Promise<void> {
    const target = await this.findUserOrThrow(targetUsername);

    const deleted = await this.prisma.follow
      .delete({ where: { followerId_followingId: { followerId, followingId: target.id } } })
      .catch(() => null);
    if (!deleted) return; // nu il urmareai - idempotent

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      }),
      this.prisma.user.update({
        where: { id: target.id },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);
  }

  async listFollowers(
    username: string,
    viewerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<PublicUser>> {
    const target = await this.findUserOrThrow(username);
    const cursor = decodeCursor(rawCursor);

    const rows = await this.prisma.follow.findMany({
      where: {
        followingId: target.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, followerId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: limit + 1,
      include: { follower: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const myFollowing = await this.myFollowingSet(viewerId);

    return {
      items: page.map((r) => this.users.toPublicUser(r.follower, myFollowing.has(r.follower.id))),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.followerId) : null,
    };
  }

  async listFollowing(
    username: string,
    viewerId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<PublicUser>> {
    const target = await this.findUserOrThrow(username);
    const cursor = decodeCursor(rawCursor);

    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: target.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, followingId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
      take: limit + 1,
      include: { following: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const myFollowing = await this.myFollowingSet(viewerId);

    return {
      items: page.map((r) => this.users.toPublicUser(r.following, myFollowing.has(r.following.id))),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.followingId) : null,
    };
  }

  async myFollowingSet(viewerId: string): Promise<Set<string>> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    return new Set(rows.map((r) => r.followingId));
  }
}
