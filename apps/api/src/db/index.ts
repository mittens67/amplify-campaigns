import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';

/**
 * Minimal database interface over two drivers:
 *  - postgres.js against Supabase Postgres (production) — direct connection so we get real
 *    transactions and row locks (not possible through supabase-js / PostgREST)
 *  - PGlite, an embedded Postgres, for local development and tests
 * Queries use positional $1 parameters. JSON values are passed as strings and cast with ::text::jsonb
 * (a bare ::jsonb makes postgres.js JSON-encode the string a second time).
 */
export interface Queryable {
  query<T = any>(text: string, params?: unknown[]): Promise<T[]>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(script: string): Promise<void>;
  close(): Promise<void>;
  driver: 'postgres' | 'pglite';
}

const here = dirname(fileURLToPath(import.meta.url));

async function createPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { prepare: false, max: 8, idle_timeout: 20, onnotice: () => {}, ssl: url.includes('localhost') ? false : 'require' });
  const wrap = (s: any): Queryable => ({
    query: async (text, params = []) => (await s.unsafe(text, params as any[])) as any[],
  });
  return {
    driver: 'postgres',
    ...wrap(sql),
    tx: (fn) => sql.begin((t: any) => fn(wrap(t))) as any,
    exec: async (script) => {
      await sql.unsafe(script);
    },
    close: () => sql.end(),
  };
}

async function createPglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  // PGlite is single-connection: serialise transactions so concurrent requests don't interleave.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };
  // Inside tx(), always use the Queryable passed to the callback (never the outer db),
  // otherwise the outer query would wait for the transaction that is waiting for it.
  return {
    driver: 'pglite',
    query: (text, params = []) => serial(async () => (await pg.query(text, params as any[])).rows as any[]),
    tx: (fn) =>
      serial(() =>
        pg.transaction((t) => fn({ query: async (text, params = []) => (await t.query(text, params as any[])).rows as any[] })),
      ) as any,
    exec: async (script) => {
      await serial(() => pg.exec(script));
    },
    close: () => pg.close(),
  };
}

let instance: Db | null = null;

export async function getDb(): Promise<Db> {
  if (instance) return instance;
  instance = env.DATABASE_URL ? await createPostgres(env.DATABASE_URL) : await createPglite(join(here, '../../.data/pg'));
  return instance;
}

export async function migrate(db: Db) {
  const schema = readFileSync(join(here, 'schema.sql'), 'utf8');
  await db.exec(schema);
}

export const json = (v: unknown) => JSON.stringify(v ?? null);
