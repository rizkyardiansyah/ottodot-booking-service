import './env';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from '../lib/db';

const MIGRATIONS_DIR = resolve(process.cwd(), 'migrations');

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql`SELECT filename FROM schema_migrations`).map((r) => r.filename),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const ddl = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
    });
    console.log(`apply  ${file}`);
  }
}

migrate()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error(err);
    await sql.end();
    process.exit(1);
  });
