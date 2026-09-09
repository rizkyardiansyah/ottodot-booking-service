import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" path alias for the server-action imports.
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // Real Postgres, no mocks. Race tests need serial execution so
    // concurrent confirms inside one test are the only contention.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgres://ottodot:ottodot@localhost:5443/ottodot',
    },
  },
});
