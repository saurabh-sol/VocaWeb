import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const sql = postgres(url, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const applied = await sql<{ name: string }[]>`SELECT name FROM _migrations ORDER BY id`;
    const appliedSet = new Set(applied.map((r) => r.name));

    const migrationsDir = join(__dirname, 'migrations');
    const files = (await readdir(migrationsDir)).filter((f: string) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const content = await readFile(join(migrationsDir, file), 'utf-8');
      console.log(`Applying migration: ${file}`);

      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });

      console.log(`Applied: ${file}`);
    }

    console.log('All migrations applied.');
  } finally {
    await sql.end();
  }
}

const isMain = process.argv[1]?.includes('migrate');
if (isMain) {
  migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
