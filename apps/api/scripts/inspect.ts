import { getDb, migrate } from '../src/db/index.js';
const db = await getDb();
try {
  await migrate(db);
  console.log('migrate ok');
} catch (e) {
  console.log('MIGRATE ERROR', (e as Error).message);
}
const r = await db.query(`select (select count(*)::int from campaigns) c, (select count(*)::int from users) u,
  (select count(*)::int from contributions) k, (select count(*)::int from notifications) n,
  (select count(*)::int from distribution_metrics) m, (select jsonb_typeof(draft_content) from campaigns limit 1) t`);
console.log(r[0]);
await db.close();
