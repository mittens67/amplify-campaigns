import { getDb, migrate } from '../db/index.js';
import { seedDemo } from './seed.js';

const db = await getDb();
await migrate(db);
await seedDemo(db);
await db.close();
