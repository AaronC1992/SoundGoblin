/**
 * Update Supabase keywords for the 12 new emergency-vehicle sounds.
 * One-off maintenance script — safe to re-run.
 *
 * Usage: node scripts/update-emergency-keywords.js
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Keyword design rules:
//  - Single words only (multi-word keywords get split by the word-boundary matcher,
//    so "air raid" matches bare "air" which is too generic).
//  - Include plurals and common verb tenses a narrator would actually say.
//  - Include colloquial synonyms (cruiser, medic, ems, blaze, twister).
//  - Skip filler tokens (by, the, up).
const UPDATES = [
  {
    name: 'police siren wail',
    keywords: ['police', 'siren', 'sirens', 'cop', 'cops', 'cruiser', 'squad', 'patrol', 'chase', 'wail', 'wailing', 'wailed', 'law', 'enforcement', 'emergency'],
  },
  {
    name: 'ambulance siren',
    keywords: ['ambulance', 'siren', 'sirens', 'medical', 'medic', 'paramedic', 'ems', 'hospital', 'rescue', 'emergency', 'injured', 'wounded', 'wail', 'wailing'],
  },
  {
    name: 'fire truck siren air horn',
    keywords: ['fire', 'firetruck', 'firefighter', 'truck', 'engine', 'pumper', 'siren', 'horn', 'blaze', 'rescue', 'emergency', 'responder', 'brigade'],
  },
  {
    name: 'distant city siren ambience',
    keywords: ['distant', 'siren', 'sirens', 'city', 'urban', 'downtown', 'background', 'ambience', 'night', 'nighttime', 'traffic', 'cityscape', 'metropolis'],
  },
  {
    name: 'air raid siren warning',
    keywords: ['raid', 'siren', 'sirens', 'warning', 'alarm', 'alert', 'war', 'wartime', 'wwii', 'evacuation', 'bombing', 'blitz', 'danger', 'wail', 'klaxon'],
  },
  {
    name: 'air raid siren single wail',
    keywords: ['raid', 'siren', 'wail', 'wailing', 'wailed', 'warning', 'alarm', 'alert', 'single', 'lone', 'distant'],
  },
  {
    name: 'tornado civil defense siren',
    keywords: ['tornado', 'twister', 'cyclone', 'siren', 'sirens', 'storm', 'warning', 'alarm', 'weather', 'shelter', 'emergency', 'warbling', 'midwest'],
  },
  {
    name: 'police radio dispatch chatter',
    keywords: ['police', 'radio', 'dispatch', 'dispatcher', 'chatter', 'static', 'scanner', 'squelch', 'cop', 'cops', 'cruiser', 'codes', 'report', 'cb'],
  },
  {
    name: 'cop car door slam',
    keywords: ['cop', 'police', 'car', 'door', 'slam', 'slammed', 'slamming', 'cruiser', 'patrol', 'squad', 'shut', 'close', 'closed'],
  },
  {
    name: 'car horn single honk',
    keywords: ['car', 'horn', 'honk', 'honks', 'honking', 'honked', 'traffic', 'urban', 'beep', 'beeps', 'beeping', 'vehicle', 'street', 'angry'],
  },
  {
    name: 'emergency scanner static',
    keywords: ['scanner', 'static', 'radio', 'emergency', 'crackle', 'crackling', 'noise', 'tuning', 'background', 'channel', 'interference'],
  },
  {
    name: 'emergency vehicle passing by',
    keywords: ['emergency', 'vehicle', 'siren', 'sirens', 'passing', 'passes', 'passed', 'doppler', 'street', 'drive', 'drives', 'driving', 'rushing', 'speeding', 'ambulance', 'police', 'firetruck'],
  },
];

async function main() {
  let ok = 0, failed = 0;
  for (const u of UPDATES) {
    const { error, data } = await supabase
      .from('sounds')
      .update({ keywords: u.keywords })
      .eq('name', u.name)
      .select('id,name,keywords');
    if (error) {
      console.error(`FAIL ${u.name}: ${error.message}`);
      failed++;
    } else if (!data?.length) {
      console.error(`MISS ${u.name}: no row matched`);
      failed++;
    } else {
      console.log(`ok  ${u.name} -> ${data[0].keywords.length} keywords`);
      ok++;
    }
  }
  console.log(`\nDone. updated=${ok} failed=${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
