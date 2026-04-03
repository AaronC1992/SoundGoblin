/**
 * GET /api/health
 * Simple health-check used by the frontend to test backend connectivity.
 *
 * TODO: Add database ping once Supabase is connected.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'soundgoblin',
    timestamp: new Date().toISOString(),
  });
}
