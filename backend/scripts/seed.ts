/**
 * Populeaza baza cu utilizatori si retete demo, ca feed-ul sa nu fie gol
 * cand testezi pe telefon. Imaginile sunt generate local cu sharp.
 *
 *   npm run seed -w @foodbook/backend
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const prisma = new PrismaClient();
const STORAGE_ROOT = resolve(process.cwd(), 'storage');
const VARIANTS = [
  { name: 'thumb', width: 400 },
  { name: 'feed', width: 1080 },
  { name: 'full', width: 1600 },
];

const USERS = [
  { username: 'maria_demo', displayName: 'Maria Popescu', bio: 'Gătesc de plăcere, mai ales deserturi.' },
  { username: 'andrei_demo', displayName: 'Andrei Ionescu', bio: 'Grătar în fiecare weekend.' },
  { username: 'ioana_demo', displayName: 'Ioana Marin', bio: 'Bucătărie vegetariană, simplu și rapid.' },
];

const RECIPES = [
  { title: 'Tort de ciocolată', color: '#4A2C2A', description: 'Un tort simplu și delicios, perfect pentru weekend.', prep: 60, servings: 8,
    ingredients: [['făină', 200, 'g'], ['zahăr', 150, 'g'], ['ciocolată', 100, 'g'], ['ouă', 2, 'buc']],
    steps: ['Amestecăm ingredientele uscate.', 'Adăugăm ouăle și ciocolata topită.', 'Coacem 30 de minute la 180°C.'] },
  { title: 'Ciorbă de burtă', color: '#C9A227', description: 'Rețeta bunicii, cu smântână și usturoi.', prep: 180, servings: 6,
    ingredients: [['burtă de vită', 1, 'kg'], ['smântână', 400, 'ml'], ['usturoi', 1, 'căpățână']],
    steps: ['Fierbem burta 3 ore.', 'Pregătim dresul din smântână și gălbenuș.', 'Servim cu ardei iute.'] },
  { title: 'Paste cu pui și smântână', color: '#D9A066', description: 'Gata în 25 de minute, cina perfectă de marți seara.', prep: 25, servings: 4,
    ingredients: [['paste', 400, 'g'], ['piept de pui', 500, 'g'], ['smântână', 200, 'ml']],
    steps: ['Fierbem pastele.', 'Rumenim puiul.', 'Combinăm cu smântâna și servim.'] },
  { title: 'Salată de vinete', color: '#6B5B95', description: null, prep: 40, servings: 4,
    ingredients: [['vinete', 3, 'buc'], ['ceapă', 1, 'buc'], ['ulei', 100, 'ml']],
    steps: ['Coacem vinetele.', 'Tocăm și amestecăm cu ceapa.'] },
  { title: 'Pizza margherita', color: '#B33A3A', description: 'Blat subțire, mozzarella și busuioc proaspăt.', prep: 90, servings: 2,
    ingredients: [['făină', 500, 'g'], ['mozzarella', 250, 'g'], ['roșii', 400, 'g']],
    steps: ['Frământăm aluatul și îl lăsăm 1 oră.', 'Întindem și adăugăm toppingul.', 'Coacem la maxim 8 minute.'] },
  { title: null, color: '#8E7C68', description: 'Clătite făcute aseară 🥞 Nimic complicat, doar bune.', prep: null, servings: null,
    ingredients: [], steps: [] },
];

async function storeImage(color: string): Promise<{ objectKey: string; width: number; height: number }> {
  const id = randomUUID();
  const objectKey = `recipes/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}`;
  const source = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: color } })
    .jpeg({ quality: 90 })
    .toBuffer();

  let largest = { width: 0, height: 0 };
  for (const variant of VARIANTS) {
    const out = await sharp(source)
      .resize({ width: variant.width, withoutEnlargement: true })
      .jpeg({ quality: variant.name === 'thumb' ? 72 : 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const path = resolve(STORAGE_ROOT, `${objectKey}_${variant.name}.jpg`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, out.data);
    if (out.info.width >= largest.width) largest = { width: out.info.width, height: out.info.height };
  }
  return { objectKey, ...largest };
}

async function main(): Promise<void> {
  if (process.env.SUPABASE_URL) {
    console.error('Seed-ul scrie doar in storage-ul local. Goleste SUPABASE_URL pentru a-l rula.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argonHash('demo-parola-123');

  const users = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { username: u.username },
        update: {},
        create: { ...u, email: `${u.username}@foodbook.local`, passwordHash },
      }),
    );
  }

  let created = 0;
  for (const [index, recipe] of RECIPES.entries()) {
    const author = users[index % users.length];
    const image = await storeImage(recipe.color);

    await prisma.recipe.create({
      data: {
        userId: author.id,
        title: recipe.title,
        description: recipe.description,
        prepMinutes: recipe.prep,
        servings: recipe.servings,
        // Decalam datele ca feed-ul sa aiba o ordine cronologica credibila.
        createdAt: new Date(Date.now() - index * 3_600_000),
        images: { create: [{ objectKey: image.objectKey, width: image.width, height: image.height, position: 0 }] },
        ingredients: {
          create: recipe.ingredients.map(([name, quantity, unit], position) => ({
            name: name as string,
            quantity: quantity as number,
            unit: unit as string,
            position,
          })),
        },
        instructions: {
          create: recipe.steps.map((text, i) => ({ stepNumber: i + 1, text })),
        },
      },
    });
    created++;
  }

  for (const user of users) {
    const count = await prisma.recipe.count({ where: { userId: user.id, deletedAt: null } });
    await prisma.user.update({ where: { id: user.id }, data: { recipesCount: count } });
  }

  console.log(`Seed complet: ${users.length} utilizatori, ${created} retete.`);
  console.log('Autentificare demo: maria_demo@foodbook.local / demo-parola-123');
}

main()
  .catch((err) => {
    console.error('Seed esuat:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
