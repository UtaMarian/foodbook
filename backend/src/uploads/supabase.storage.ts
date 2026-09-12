import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './storage.service';

/**
 * Supabase Storage e compatibil cu un API simplu de tip obiect (nu S3),
 * expus prin @supabase/supabase-js. Folosim cheia "secret" (service role)
 * ca sa scriem/stergem fara sa depindem de reguli RLS - acceptabil pentru
 * un backend de incredere care nu expune niciodata cheia clientului.
 */
@Injectable()
export class SupabaseStorage extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorage.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  readonly publicBase: string;

  constructor(config: ConfigService) {
    super();
    const url = config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    this.bucket = config.get<string>('SUPABASE_BUCKET', 'foodbook-media');
    this.client = createClient(url, config.getOrThrow<string>('SUPABASE_SECRET_KEY'), {
      auth: { persistSession: false },
    });
    this.publicBase = `${url}/storage/v1/object/public/${this.bucket}`;
    this.logger.log(`Storage: Supabase (${this.bucket})`);
  }

  /** Creeaza bucket-ul daca nu exista deja - idempotent, sigur la fiecare pornire. */
  async onModuleInit(): Promise<void> {
    const { error } = await this.client.storage.createBucket(this.bucket, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      this.logger.warn(`Nu am putut asigura bucket-ul "${this.bucket}": ${error.message}`);
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(key, body, {
      contentType,
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) throw new Error(`Supabase upload esuat pentru ${key}: ${error.message}`);
  }

  async delete(key: string): Promise<void> {
    await this.client.storage.from(this.bucket).remove([key]);
  }
}
