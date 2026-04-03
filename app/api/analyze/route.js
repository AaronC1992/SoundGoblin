/**
 * POST /api/analyze
 * Analyzes a story transcript and returns an AI sound decision.
 *
 * Currently proxies to the external Render backend. Once the backend is
 * migrated into this Next.js project, the OpenAI call will happen here
 * directly (server-side, key never exposed to the browser).
 *
 * TODO: Move OpenAI call here and remove the external Render backend.
 * TODO: Add auth middleware — validate Bearer token / Stripe subscription.
 * TODO: Add per-user rate limiting via Upstash/Redis.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://cueai-backend.onrender.com';
const BACKEND_TIMEOUT_MS = 28_000;

export async function POST(request) {
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

  // Forward the Authorization header from the client (subscription token)
  const authHeader = request.headers.get('authorization') || '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ transcript, mode, context }),
      signal: controller.signal,
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
    }
    console.error('[/api/analyze]', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
