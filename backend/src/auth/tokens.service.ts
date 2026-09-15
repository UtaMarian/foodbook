import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthTokens } from '@foodbook/shared';

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Refresh tokenul nu se salveaza niciodata in clar. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlToMs(ttl: string): number {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) throw new Error(`TTL invalid: ${ttl}`);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's'];
    return Number(m[1]) * mult;
  }

  async issue(user: { id: string; username: string }, deviceInfo?: string): Promise<AuthTokens> {
    const accessTtl = this.config.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtl = this.config.getOrThrow<string>('JWT_REFRESH_TTL');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, username: user.username },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + this.ttlToMs(refreshTtl)),
        deviceInfo: deviceInfo?.slice(0, 200) ?? null,
      },
    });

    return { accessToken, refreshToken, expiresIn: Math.floor(this.ttlToMs(accessTtl) / 1000) };
  }

  /** Rotatie: tokenul vechi e revocat imediat ce a fost folosit. */
  async rotate(refreshToken: string, deviceInfo?: string): Promise<AuthTokens | null> {
    const tokenHash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!stored) return null;

    if (stored.revokedAt) {
      // Token reutilizat => posibil furt. Invalidam toate sesiunile utilizatorului.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    if (stored.expiresAt < new Date()) return null;

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(stored.user, deviceInfo);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Foloseste la respingerea unui cont din panoul admin: taie orice sesiune activa. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
