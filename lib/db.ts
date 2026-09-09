import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// One shared connection pool for the whole app. Server-side only —
// importing this into a client bundle would leak the connection string.
export const sql = postgres(connectionString);
