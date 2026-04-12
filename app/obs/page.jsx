'use client';

import dynamic from 'next/dynamic';

/**
 * OBS Browser Source page — a minimal, transparent-background wrapper
 * that runs the Effexiq engine for audio capture by OBS Studio.
 *
 * Usage: Add this URL as a Browser Source in OBS:
 *   https://your-domain.com/obs
 *
 * The page has a transparent background so it can overlay scenes.
 * Only the currently-playing sounds list and status text are shown.
 */
const ObsShell = dynamic(() => import('../../components/ObsShell'), {
  ssr: false,
  loading: () => null,
});

export default function ObsPage() {
  return <ObsShell />;
}
