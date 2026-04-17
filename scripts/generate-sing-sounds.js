/**
 * Generate Sing Mode backing music + crowd reactions via ElevenLabs Sound
 * Generation API, upload to R2, and append to public/saved-sounds.json.
 *
 * Usage: node scripts/generate-sing-sounds.js
 *
 * Tracks are instrumental / karaoke-style so they don't fight a live singer.
 * Each track's `keywords` include a tempo bucket ("bpm-80" etc.), a mood word,
 * and "instrumental"/"karaoke" so MODE_RULES.sing can tempo-match via
 * detectedBPM in the AI prompt.
 *
 * Requires .env.local with ELEVENLABS_API_KEY and R2_* variables.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BUCKET = process.env.R2_BUCKET_NAME || 'cueai-media';
const PREFIX = 'Saved sounds/';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ─────────────────────────────────────────────────────────────────────────
// SING MODE LIBRARY
// Buckets: ballad (60-80 BPM), mid (80-110 BPM), upbeat (110-130),
//          driving (130-160). Plus a few crowd SFX for song-end applause.
// ─────────────────────────────────────────────────────────────────────────
const SING_SOUNDS = [
  // ═══════ BALLAD / SLOW (60-80 BPM) — instrumental backing ═══════
  {
    name: 'sing ballad piano slow',
    filename: 'sing-ballad-piano-slow.mp3',
    prompt: 'Slow emotional piano ballad instrumental backing track, 70 BPM, no vocals, gentle chord progression in C major, soft sustain pedal, perfect for a singer to sing over, karaoke style, warm studio recording',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'slow', 'piano', 'emotional', 'bpm-70', 'tempo-slow', 'gentle', 'romantic'],
    loop: true,
    bpm: 70
  },
  {
    name: 'sing ballad acoustic guitar',
    filename: 'sing-ballad-acoustic-guitar.mp3',
    prompt: 'Slow acoustic guitar ballad instrumental, 72 BPM, fingerpicked steel-string in G major, warm and intimate, no vocals, singer-songwriter backing track, coffeehouse karaoke',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'acoustic', 'guitar', 'fingerpicked', 'bpm-72', 'tempo-slow', 'intimate', 'warm'],
    loop: true,
    bpm: 72
  },
  {
    name: 'sing ballad strings cinematic',
    filename: 'sing-ballad-strings-cinematic.mp3',
    prompt: 'Slow cinematic string ballad instrumental, 68 BPM, lush orchestral strings in D minor, emotional and swelling, no vocals, epic backing track for a powerful singer, film-score style',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'strings', 'orchestral', 'cinematic', 'bpm-68', 'tempo-slow', 'emotional', 'sad'],
    loop: true,
    bpm: 68
  },

  // ═══════ MID-TEMPO (80-110 BPM) — pop/folk/soul backing ═══════
  {
    name: 'sing mid pop backing',
    filename: 'sing-mid-pop-backing.mp3',
    prompt: 'Mid-tempo pop instrumental backing track, 96 BPM, clean electric guitar, light drums, warm bass, no vocals, modern pop song karaoke style in A major, radio-friendly',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop', 'mid-tempo', 'upbeat', 'bpm-96', 'tempo-mid', 'warm', 'modern'],
    loop: true,
    bpm: 96
  },
  {
    name: 'sing mid soul groove',
    filename: 'sing-mid-soul-groove.mp3',
    prompt: 'Mid-tempo soul and R&B instrumental backing groove, 92 BPM, electric piano, funky bass, soft drums and hi-hats, no vocals, smooth karaoke track in F minor',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'soul', 'rnb', 'groove', 'funk', 'bpm-92', 'tempo-mid', 'smooth'],
    loop: true,
    bpm: 92
  },
  {
    name: 'sing mid folk strum',
    filename: 'sing-mid-folk-strum.mp3',
    prompt: 'Mid-tempo folk instrumental backing track, 100 BPM, strummed acoustic guitar, light tambourine, no vocals, happy indie folk karaoke in D major, campfire energy',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'folk', 'acoustic', 'strum', 'indie', 'bpm-100', 'tempo-mid', 'happy', 'uplifting'],
    loop: true,
    bpm: 100
  },
  {
    name: 'sing mid country twang',
    filename: 'sing-mid-country-twang.mp3',
    prompt: 'Mid-tempo country instrumental backing, 104 BPM, twangy electric guitar, brushed drums, walking bass, no vocals, classic country karaoke in G major, honky-tonk',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'country', 'twang', 'honky-tonk', 'bpm-104', 'tempo-mid'],
    loop: true,
    bpm: 104
  },

  // ═══════ UPBEAT (110-130 BPM) — pop/rock karaoke ═══════
  {
    name: 'sing upbeat indie pop',
    filename: 'sing-upbeat-indie-pop.mp3',
    prompt: 'Upbeat indie pop instrumental backing track, 118 BPM, bright jangly electric guitar, punchy drums, synth bass, no vocals, happy karaoke song in E major, summer energy',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'indie', 'pop', 'upbeat', 'bright', 'bpm-118', 'tempo-upbeat', 'happy', 'summer'],
    loop: true,
    bpm: 118
  },
  {
    name: 'sing upbeat rock anthem',
    filename: 'sing-upbeat-rock-anthem.mp3',
    prompt: 'Upbeat rock anthem instrumental backing track, 124 BPM, driving electric guitars, full drum kit, no vocals, stadium karaoke rock in A major, powerful and anthemic',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'anthem', 'stadium', 'powerful', 'bpm-124', 'tempo-upbeat', 'energetic'],
    loop: true,
    bpm: 124
  },
  {
    name: 'sing upbeat disco funk',
    filename: 'sing-upbeat-disco-funk.mp3',
    prompt: 'Upbeat disco funk instrumental backing track, 120 BPM, four-on-the-floor drums, slap bass, funky guitar chicks, strings, no vocals, retro dance karaoke in Em',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'disco', 'funk', 'dance', 'retro', 'bpm-120', 'tempo-upbeat'],
    loop: true,
    bpm: 120
  },

  // ═══════ DRIVING / FAST (130-160 BPM) ═══════
  {
    name: 'sing fast punk pop',
    filename: 'sing-fast-punk-pop.mp3',
    prompt: 'Fast punk pop instrumental backing track, 150 BPM, distorted power chords, fast punk drums, driving bass, no vocals, energetic karaoke pop-punk in D major',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'punk', 'pop-punk', 'fast', 'energetic', 'bpm-150', 'tempo-fast'],
    loop: true,
    bpm: 150
  },
  {
    name: 'sing fast edm dance',
    filename: 'sing-fast-edm-dance.mp3',
    prompt: 'Fast EDM dance instrumental backing track, 128 BPM, pulsing synth bass, four-on-the-floor kick, sidechained pads, no vocals, festival karaoke club anthem in F minor',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'edm', 'dance', 'club', 'festival', 'bpm-128', 'tempo-upbeat', 'synth'],
    loop: true,
    bpm: 128
  },

  // ═══════ SPECIALTY / MOOD PICKS ═══════
  {
    name: 'sing jazz lounge backing',
    filename: 'sing-jazz-lounge-backing.mp3',
    prompt: 'Slow smoky jazz lounge instrumental backing, 84 BPM, upright bass, brushed snare, soft Rhodes piano, muted trumpet accents, no vocals, smoky cocktail bar karaoke in Bb',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jazz', 'lounge', 'smoky', 'smooth', 'bpm-84', 'tempo-mid'],
    loop: true,
    bpm: 84
  },
  {
    name: 'sing gospel uplift backing',
    filename: 'sing-gospel-uplift-backing.mp3',
    prompt: 'Uplifting gospel instrumental backing, 88 BPM, Hammond organ, warm piano, soft choir pads (no lead vocals), gentle drums, no solo vocals, soulful karaoke in F major',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'gospel', 'uplifting', 'soulful', 'organ', 'bpm-88', 'tempo-mid', 'hopeful'],
    loop: true,
    bpm: 88
  },
  {
    name: 'sing reggae chill backing',
    filename: 'sing-reggae-chill-backing.mp3',
    prompt: 'Chill reggae instrumental backing track, 76 BPM, off-beat skank guitar, deep bass, tight drums, no vocals, laid-back island karaoke in A major',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'reggae', 'chill', 'island', 'laid-back', 'bpm-76', 'tempo-slow'],
    loop: true,
    bpm: 76
  },

  // ═══════ CROWD REACTIONS for song-end applause ═══════
  {
    name: 'sing applause big crowd',
    filename: 'sing-applause-big-crowd.mp3',
    prompt: 'Large enthusiastic concert crowd clapping and cheering after a song, big arena applause, whistles and shouts, triumphant ovation, stadium reaction',
    duration: 7,
    type: 'sfx',
    keywords: ['applause', 'clap', 'cheer', 'crowd', 'ovation', 'concert', 'sing', 'song-end', 'arena', 'stadium'],
    loop: false
  },
  {
    name: 'sing applause small intimate',
    filename: 'sing-applause-small-intimate.mp3',
    prompt: 'Small intimate audience clapping politely after a song, coffeehouse applause, 15-20 people, warm and genuine, small venue',
    duration: 5,
    type: 'sfx',
    keywords: ['applause', 'clap', 'cheer', 'crowd', 'intimate', 'coffeehouse', 'sing', 'song-end', 'small'],
    loop: false
  },
  {
    name: 'sing crowd whistle cheer',
    filename: 'sing-crowd-whistle-cheer.mp3',
    prompt: 'Excited crowd whistling and cheering enthusiastically, loud single whistles plus yeah shouts and claps, encore reaction, performance appreciation',
    duration: 4,
    type: 'sfx',
    keywords: ['whistle', 'cheer', 'crowd', 'applause', 'sing', 'song-end', 'encore', 'enthusiastic'],
    loop: false
  }
];

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    // Network hiccup: treat as missing so we try to re-upload.
    return false;
  }
}

async function generateAndUpload(sound) {
  const r2Key = `${PREFIX}${sound.filename}`;

  if (await objectExists(r2Key)) {
    console.log(`  - Already in R2, skipping generation: ${sound.filename}`);
    return true;
  }

  console.log(`  • Generating via ElevenLabs: ${sound.name} (${sound.duration}s)...`);
  const resp = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sound.prompt,
      duration_seconds: sound.duration,
      // Lower prompt_influence lets the model be more musical / less literal.
      prompt_influence: 0.35
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    console.error(`    ! ElevenLabs error ${resp.status}: ${err}`);
    return false;
  }

  const audio = Buffer.from(await resp.arrayBuffer());
  console.log(`    ✓ Generated ${(audio.length / 1024).toFixed(1)} KB`);

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: audio,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`    ↑ Uploaded: ${r2Key}`);
  return true;
}

async function main() {
  if (!API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY in .env.local');
    process.exit(1);
  }

  const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
  const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
  const catalog = catalogJson.files || catalogJson;
  const existingNames = new Set(catalog.map(s => s.name));

  console.log(`Starting Sing Mode generation — ${SING_SOUNDS.length} sounds planned.`);
  let successes = 0;
  let skippedCatalog = 0;
  let failures = 0;

  for (const sound of SING_SOUNDS) {
    console.log(`\n→ ${sound.name}`);

    const ok = await generateAndUpload(sound);
    if (!ok) { failures++; continue; }

    if (existingNames.has(sound.name)) {
      console.log(`  = Already in catalog, not duplicating.`);
      skippedCatalog++;
      continue;
    }

    const entry = {
      type: sound.type,
      name: sound.name,
      file: `Saved sounds/${sound.filename}`,
      keywords: sound.keywords,
    };
    if (sound.loop) entry.loop = true;
    if (sound.bpm) entry.bpm = sound.bpm;
    catalog.push(entry);
    existingNames.add(sound.name);
    successes++;

    // Pause a tick between generations to be polite to ElevenLabs.
    await new Promise(r => setTimeout(r, 400));
  }

  await writeFile(catalogPath, JSON.stringify({ files: catalog }, null, 2));
  console.log(`\n— Done.`);
  console.log(`  New catalog entries: ${successes}`);
  console.log(`  Already in catalog:  ${skippedCatalog}`);
  console.log(`  Failures:            ${failures}`);
  console.log(`  Total catalog size:  ${catalog.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
