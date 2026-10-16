import { env } from './env.js';
import { createApp } from './app.js';
import { getDb, migrate } from './db/index.js';
import { clock } from './lib/clock.js';
import { seedDemo } from './seed/seed.js';
import { ensureBucket } from './services/storage.js';

async function main() {
  const db = await getDb();
  await migrate(db);
  await clock.load(db);
  const [{ n }] = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM users');
  if (n === 0) {
    console.log('[seed] empty database — seeding demo data…');
    await seedDemo(db);
  }
  await ensureBucket().catch((e) => console.warn('[storage]', e.message));
  const app = createApp(db);
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[api] listening on :${env.PORT} (db: ${db.driver}, ai: ${env.GROQ_API_KEY ? 'groq' : 'template'})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
