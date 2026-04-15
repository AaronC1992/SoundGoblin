/**
 * POST /api/analyze
 * Analyzes a story transcript via OpenAI and returns a sound decision.
 * The API key lives server-side only — never exposed to the browser.
 *
 * TODO: Add auth middleware — validate Bearer token / Stripe subscription.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';
import { MODE_CONTEXTS, MODE_RULES } from '../../../lib/modules/ai-director.js';

let _openai;
function getOpenAI() {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

// --- In-memory rate limiting (per IP, resets on deploy) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15;           // max requests per window per IP
const rateLimitMap = new Map();      // ip -> { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  // Inline cleanup: cap map size and prune stale entries
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (now >= v.resetAt) rateLimitMap.delete(k);
    }
  }
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining, resetAt: entry.resetAt };
}

// --- Response cache (hash-based dedup for identical transcripts) ---
const CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_CACHE_SIZE = 500;
const responseCache = new Map(); // hash -> { data, expiresAt }

function getCacheKey(transcript, mode, context) {
  const raw = JSON.stringify({ transcript: transcript.trim().toLowerCase(), mode, context });
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function getCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict oldest entries if over limit
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const SYSTEM_PROMPT = `You are Effexiq, an AI sound director for live narration sessions.
Given a transcript of what is being narrated, respond with a JSON object that drives a layered audio engine.

RESPONSE FORMAT (strict JSON):
{
  "scene": "short description of the current scene/setting",
  "mood": {
    "primary": "one of: calm, tense, happy, sad, angry, fearful, mysterious, excited, ominous, neutral",
    "intensity": 0.0 to 1.0
  },
  "confidence": 0.0 to 1.0,
  "music": {
    "id": "catalog ID or null",
    "action": "play_or_continue",
    "volume": 0.0 to 1.0
  },
  "sfx": [
    {
      "id": "catalog ID",
      "when": "immediate",
      "volume": 0.0 to 1.0,
      "tags": ["keyword1", "keyword2"]
    }
  ]
}

RULES:
- "scene" drives ambient bed selection. Use descriptive keywords: forest, cave, tavern, cottage, castle, ocean, rain, battle, etc.
- "mood.primary" + "mood.intensity" drive the emotional arc and scene state machine. Be consistent — don't flip moods every response.
- "confidence" reflects how certain you are about the scene/mood. Set lower (0.3-0.5) when the transcript is ambiguous.
- "music" — only suggest a change when the scene or mood shifts significantly. Use "action": "play_or_continue" to keep current music playing. Set to null if no change needed.
- "sfx" — array of sound effects. Only include sounds that are clearly described or implied in the transcript. Max 2 per response. Use descriptive tags so the engine can search for them. Do NOT hallucinate sounds that weren't mentioned.
- Prioritize atmosphere over action. Ambient context (forest sounds, wind, fire) is more important than one-off SFX.
- Avoid repeating the same SFX across consecutive responses.
- Never include sounds that contradict the current scene (e.g. no crowd noise in a lonely forest).`;

function buildUserMessage(transcript, mode, context) {
  const modeContext = MODE_CONTEXTS[mode] || MODE_CONTEXTS.auto;
  const modeRule = MODE_RULES[mode] || MODE_RULES.auto;

  const parts = [
    `Transcript: "${transcript.trim()}"`,
    `Mode: ${mode || 'auto'} (${modeContext})`,
    modeRule,
  ];

  if (context) {
    if (context.sceneState) parts.push(`Current scene state: ${context.sceneState}`);
    if (context.sceneMemory) parts.push(`Scene history: ${context.sceneMemory}`);
    if (context.moodHistory) parts.push(`Mood history: ${context.moodHistory}`);
    if (context.recentMusic) parts.push(`Currently playing music: ${context.recentMusic}`);
    if (context.recentSounds?.length) parts.push(`Recent SFX: ${context.recentSounds.join(', ')}`);
    if (context.storyTitle) parts.push(`Story: ${context.storyTitle}`);
    if (context.sessionContext) parts.push(`Session context: ${context.sessionContext}`);
  }

  return parts.join('\n');
}

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  // Rate limiting by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { transcript, mode, context } = body;
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
  }

  // Check response cache for identical recent requests
  const cacheKey = getCacheKey(transcript, mode, context);
  const cached = getCache(cacheKey);
  if (cached) {
    const res = NextResponse.json(cached);
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Cache', 'HIT');
    return res;
  }

  const userMessage = buildUserMessage(transcript, mode, context);

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    const data = JSON.parse(raw);

    // Cache the response for dedup
    setCache(cacheKey, data);

    const res = NextResponse.json(data);
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    res.headers.set('X-Cache', 'MISS');
    return res;
  } catch (err) {
    console.error('[/api/analyze]', err);
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limited by OpenAI' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
