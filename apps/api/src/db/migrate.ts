/** Aplica las migraciones de ./drizzle (npm run db:migrate) */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'path';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const folder = resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder: folder });
  await pool.end();
  console.log('✓ Base de datos al día');
}

main().catch((err) => {
  console.error('✗ No se pudieron aplicar las migraciones:', err.message);
  process.exit(1);
});
