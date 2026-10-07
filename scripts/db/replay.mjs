import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile, readdir } from 'node:fs/promises';
export async function replay() {
  const db = await PGlite.create({ extensions: { vector, pgcrypto } });
  try {
    await db.exec(await readFile(new URL('./bootstrap-embedded.sql', import.meta.url), 'utf8'));
    const directory = new URL('../../supabase/migrations/', import.meta.url);
    const migrations = (await readdir(directory)).filter(p => p.endsWith('.sql')).sort();
    for (const migration of migrations) {
      try { await db.exec(await readFile(new URL(migration, directory), 'utf8')); }
      catch (error) { throw new Error(`Migration ${migration} failed: ${error.message}`, { cause: error }); }
    }
    return { db, migrations };
  } catch (error) { await db.close(); throw error; }
}
