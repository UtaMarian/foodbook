import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET prea scurt'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET prea scurt'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('foodbook-media'),

  PUBLIC_API_URL: z.string().default('http://localhost:3000'),
  MAX_IMAGE_BYTES: z.coerce.number().int().default(8 * 1024 * 1024),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configurare invalida in .env:\n${issues}`);
  }
  return parsed.data;
}

/** Supabase e activ doar daca URL-ul si cheia secreta sunt setate. */
export function isSupabaseConfigured(env: AppEnv): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
}
