/**
 * GET /api/stories
 * Returns all stories from Supabase.
 *
 * POST /api/stories
 * Creates a new user story. Requires auth in a future iteration.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase.js';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('stories')
      .select('id, title, theme, description, body, demo')
      .order('demo', { ascending: false }) // demo stories first
      .order('title', { ascending: true });

    if (error) throw error;

    // Rename `body` → `text` to match the engine's expected shape
    const stories = (data ?? []).map(({ body, ...rest }) => ({ ...rest, text: body }));

    return NextResponse.json({ stories });
  } catch (err) {
    console.error('[/api/stories GET]', err);
    return NextResponse.json({ error: 'Failed to load stories' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, theme, description, text } = body;

    if (!title || !text) {
      return NextResponse.json({ error: 'title and text are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('stories')
      .insert({ title, theme, description, body: text, demo: false })
      .select('id, title, theme, description, body, demo')
      .single();

    if (error) throw error;

    const { body: storyBody, ...rest } = data;
    return NextResponse.json({ story: { ...rest, text: storyBody } }, { status: 201 });
  } catch (err) {
    console.error('[/api/stories POST]', err);
    return NextResponse.json({ error: 'Failed to save story' }, { status: 500 });
  }
}
