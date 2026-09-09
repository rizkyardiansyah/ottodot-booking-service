import './env';
import { sql } from '../lib/db';

// Full recreate. `db:reset` chains this with db:migrate + db:seed.
async function reset() {
  await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('dropped and recreated schema public');
}

reset()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error(err);
    await sql.end();
    process.exit(1);
  });
