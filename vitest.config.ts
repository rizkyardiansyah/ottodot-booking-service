import { defineConfig } from 'vitest/config';

export default defineConfig({
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
