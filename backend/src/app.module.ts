import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './common/config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UserOrIpThrottlerGuard } from './common/guards/user-or-ip-throttler.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UploadsModule } from './uploads/uploads.module';
import { RecipesModule } from './recipes/recipes.module';
import { FeedModule } from './feed/feed.module';
import { SocialModule } from './social/social.module';
import { CategoriesModule } from './categories/categories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    JwtModule.register({ global: true }),
    // Plafon implicit generos (protectie DoS) - rutele sensibile isi
    // suprascriu limita cu @Throttle({ default: { limit, ttl } }).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    UploadsModule,
    UsersModule,
    AuthModule,
    RecipesModule,
    FeedModule,
    SocialModule,
    CategoriesModule,
    NotificationsModule,
    SearchModule,
    SettingsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Deny-by-default: orice endpoint cere token daca nu e marcat @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Ruleaza dupa JwtAuthGuard (ordinea conteaza): req.user e deja populat,
    // deci rate limiting-ul urmareste utilizatorul, nu doar IP-ul.
    { provide: APP_GUARD, useClass: UserOrIpThrottlerGuard },
  ],
})
export class AppModule {}
