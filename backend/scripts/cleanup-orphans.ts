/**
 * Sterge imaginile urcate care nu au ajuns niciodata intr-o reteta.
 * Fara asta, fiecare compozitie abandonata lasa 3 fisiere in storage pe veci.
 *
 * Ruleaza zilnic:  npm run cleanup:orphans
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const GRACE_HOURS = 24;
const VARIANTS = ['thumb', 'feed', 'full'] as const;

const prisma = new PrismaClient();

function supabaseClient(): { client: ReturnType<typeof createClient>; bucket: string } | null {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_BUCKET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  return {
    bucket: SUPABASE_BUCKET ?? 'foodbook-media',
    client: createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } }),
  };
}

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - GRACE_HOURS * 3600_000);

  const orphans = await prisma.uploadedImage.findMany({
    where: { consumedAt: null, createdAt: { lt: cutoff } },
    select: { id: true, objectKey: true },
  });

  if (orphans.length === 0) {
    console.log('Nicio imagine orfana.');
    return;
  }

  const keys = orphans.flatMap((o) => VARIANTS.map((v) => `${o.objectKey}_${v}.jpg`));
  const supabase = supabaseClient();

  if (supabase) {
    // remove() accepta maximum 1000 de chei pe cerere.
    for (let i = 0; i < keys.length; i += 1000) {
      await supabase.client.storage.from(supabase.bucket).remove(keys.slice(i, i + 1000));
    }
  } else {
    const root = resolve(process.cwd(), 'storage');
    await Promise.all(keys.map((k) => unlink(resolve(root, k)).catch(() => undefined)));
  }

  await prisma.uploadedImage.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  console.log(`Sterse ${orphans.length} imagini orfane (${keys.length} fisiere).`);
}

main()
  .catch((err) => {
    console.error('Curatarea a esuat:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
