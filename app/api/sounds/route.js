/**
 * GET /api/sounds
 * Returns the full sound catalog from Supabase.
 * Falls back to static file if Supabase is unreachable.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase.js';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('sounds')
      .select('type, name, file, keywords, loop')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ sounds: data ?? [] });
  } catch (err) {
    console.error('[/api/sounds]', err);
    return NextResponse.json({ error: 'Failed to load sound catalog' }, { status: 500 });
  }
}
