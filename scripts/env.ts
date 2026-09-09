import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Next.js loads .env.local on its own; standalone tsx scripts do not.
// Minimal loader so `pnpm db:*` works without adding a dotenv dependency.
const path = resolve(process.cwd(), '.env.local');

if (existsSync(path)) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = (match[2] ?? '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgres://ottodot:ottodot@localhost:5443/ottodot';
}
