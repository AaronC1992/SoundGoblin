/**
 * scripts/seed.js
 * Seeds the Supabase database with sounds and stories from the original JSON files.
 *
 * Run with:  node scripts/seed.js
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — the anon key cannot insert data.
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Load .env.local
dotenv.config({ path: path.join(root, '.env.local') });

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Seed sounds ──────────────────────────────────────────────────────────────

function parseJson(raw) {
  // Strip UTF-8 BOM if present
  return JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
}

async function seedSounds() {
  const filePath = path.join(root, 'public', 'saved-sounds.json');
  const raw = await readFile(filePath, 'utf-8');
  const data = parseJson(raw);
  const files = Array.isArray(data?.files) ? data.files : [];

  const rows = files.map((s) => ({
    type: s.type ?? 'sfx',
    name: s.name,
    file: s.file,
    keywords: s.keywords ?? [],
    loop: s.loop ?? false,
  }));

  console.log(`Seeding ${rows.length} sounds...`);

  // Upsert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from('sounds').upsert(batch, { onConflict: 'name' });
    if (error) {
      console.error(`  Error at batch ${i / 100 + 1}:`, error.message);
    } else {
      console.log(`  Batch ${i / 100 + 1}: ${batch.length} rows inserted`);
    }
  }
}

// ─── Seed stories ─────────────────────────────────────────────────────────────

async function seedStories() {
  const filePath = path.join(root, 'public', 'stories.json');
  const raw = await readFile(filePath, 'utf-8');
  const data = parseJson(raw);
  const stories = Array.isArray(data?.stories) ? data.stories : [];

  const rows = stories.map((s) => ({
    id: s.id,
    title: s.title,
    theme: s.theme ?? null,
    description: s.description ?? null,
    body: s.text,
    demo: s.demo ?? false,
  }));

  console.log(`Seeding ${rows.length} stories...`);

  const { error } = await supabase.from('stories').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('  Error seeding stories:', error.message);
  } else {
    console.log(`  ${rows.length} stories inserted`);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('Connecting to:', NEXT_PUBLIC_SUPABASE_URL);
  await seedSounds();
  await seedStories();
  console.log('\nDone.');
})();
