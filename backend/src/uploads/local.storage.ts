import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { StorageService } from './storage.service';

/**
 * Fallback pentru dezvoltare, cat timp Supabase nu e configurat.
 * Fisierele ajung in backend/storage si sunt servite pe /static.
 */
@Injectable()
export class LocalStorage extends StorageService {
  private readonly logger = new Logger(LocalStorage.name);
  private readonly root = resolve(process.cwd(), 'storage');
  readonly publicBase: string;

  constructor(config: ConfigService) {
    super();
    this.publicBase = `${config.get<string>('PUBLIC_API_URL', 'http://localhost:3000').replace(/\/$/, '')}/static`;
    this.logger.warn(`Storage: local (${this.root}). Seteaza SUPABASE_URL/SUPABASE_SECRET_KEY pentru productie.`);
  }

  private path(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root)) throw new Error('Cheie de obiect invalida');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async delete(key: string): Promise<void> {
    await unlink(this.path(key)).catch(() => undefined);
  }

  get storageRoot(): string {
    return join(this.root);
  }
}
