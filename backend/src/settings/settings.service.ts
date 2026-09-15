import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const REQUIRE_APPROVAL_KEY = 'requireApproval';

/**
 * Setari globale, cheie-valoare - permite comutatoare noi din panoul admin
 * fara migrari suplimentare. Daca un rand lipseste (baza proaspata),
 * valoarea implicita e cea mai putin surprinzatoare (poarta oprita).
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRequireApproval(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: REQUIRE_APPROVAL_KEY } });
    return row?.value === 'true';
  }

  async setRequireApproval(value: boolean): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: REQUIRE_APPROVAL_KEY },
      create: { key: REQUIRE_APPROVAL_KEY, value: String(value) },
      update: { value: String(value) },
    });
  }
}
