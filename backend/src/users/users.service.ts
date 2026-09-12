import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { MediaService } from '../uploads/media.service';
import { ImageService } from '../uploads/image.service';
import type { AuthUser, PublicUser, UpdateProfileInput } from '@foodbook/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly images: ImageService,
  ) {}

  toPublicUser(user: User, isFollowedByMe = false): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: this.media.url(user.avatarKey, 'thumb'),
      bio: user.bio,
      recipesCount: user.recipesCount,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowedByMe,
      createdAt: user.createdAt.toISOString(),
    };
  }

  toAuthUser(user: User): AuthUser {
    return { ...this.toPublicUser(user, false), email: user.email };
  }

  async getAuthUser(id: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilizator inexistent');
    return this.toAuthUser(user);
  }

  /**
   * `isFollowing` foloseste direct prisma (nu FollowsService) ca sa evitam o
   * dependinta circulara intre modulele users si social.
   */
  private async isFollowedBy(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return false;
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      select: { followerId: true },
    });
    return row !== null;
  }

  async getByUsername(username: string, viewerId?: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    if (!user) throw new NotFoundException('Utilizator inexistent');
    const isFollowedByMe = viewerId ? await this.isFollowedBy(viewerId, user.id) : false;
    return this.toPublicUser(user, isFollowedByMe);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.bio !== undefined ? { bio: input.bio?.trim() || null } : {}),
      },
    });
    return this.toAuthUser(user);
  }

  async setAvatar(id: string, buffer: Buffer): Promise<AuthUser> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { avatarKey: true },
    });
    const stored = await this.images.store(buffer, 'avatars', ['thumb', 'feed']);
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarKey: stored.objectKey },
    });
    if (current?.avatarKey) {
      await this.images.remove(current.avatarKey, ['thumb', 'feed']).catch(() => undefined);
    }
    return this.toAuthUser(user);
  }
}
