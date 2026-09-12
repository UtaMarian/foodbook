import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokensService } from './tokens.service';
import { UsersService } from '../users/users.service';
import type { AuthTokens, AuthUser, LoginInput, RegisterInput } from '@foodbook/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  async register(
    input: RegisterInput,
    deviceInfo?: string,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === email ? 'Exista deja un cont cu acest email' : 'Username-ul e deja luat',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        displayName: input.displayName.trim(),
        passwordHash: await argonHash(input.password),
      },
    });

    return {
      user: this.users.toAuthUser(user),
      tokens: await this.tokens.issue(user, deviceInfo),
    };
  }

  async login(
    input: LoginInput,
    deviceInfo?: string,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Mesaj identic pentru email inexistent si parola gresita: nu divulgam ce conturi exista.
    const invalid = new UnauthorizedException('Email sau parola gresite');
    if (!user) {
      await argonHash('dummy-password-to-equalize-timing');
      throw invalid;
    }
    if (!(await argonVerify(user.passwordHash, input.password))) throw invalid;

    return {
      user: this.users.toAuthUser(user),
      tokens: await this.tokens.issue(user, deviceInfo),
    };
  }

  async refresh(refreshToken: string, deviceInfo?: string): Promise<AuthTokens> {
    const tokens = await this.tokens.rotate(refreshToken, deviceInfo);
    if (!tokens) throw new UnauthorizedException('Sesiune expirata. Autentifica-te din nou.');
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }
}
