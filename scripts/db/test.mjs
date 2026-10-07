import { readFile } from 'node:fs/promises';
import { replay } from './replay.mjs';
const { db, migrations } = await replay();
try {
  const results = await db.exec(await readFile(new URL('../../supabase/tests/permissions.sql', import.meta.url), 'utf8'));
  const assertions = results.flatMap(r => r.rows ?? []).filter(row => 'assert' in row || 'expect_denied' in row).length;
  console.log(`PASS: ${migrations.length} migrations replayed; ${assertions} database assertions. Embedded PostgreSQL only; not live Supabase Auth/PostgREST.`);
} finally { await db.close(); }
