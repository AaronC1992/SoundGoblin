'use client';
/**
 * GlobalAudioKill — mounts at the root layout so EVERY route (landing page
 * included) gets a zombie-audio killer, not just /dashboard.
 *
 * Why this exists: the engine's own pagehide/pageshow handlers only run
 * while the dashboard is loaded. If the OS bfcaches the dashboard tree and
 * the user reopens the app on the landing page, there's no engine code on
 * that route to stop the old audio. This component fills that gap.
 *
 * It:
 *  1. Stops every Howler instance on pagehide (tab closing / backgrounded)
 *  2. On pageshow, if the page came out of bfcache, stops audio again
 *  3. Attempts to close any lingering WebAudio AudioContext so the OS
 *     actually releases the media graph (not just silences it).
 *
 * Safe on SSR — all work is inside useEffect.
 */
import { useEffect } from 'react';

export default function GlobalAudioKill() {
  useEffect(() => {
    const killAll = () => {
      // 1) Howler — the engine uses it for every playback path.
      try {
        const Howler = window.Howler;
        if (Howler && Array.isArray(Howler._howls)) {
          Howler._howls.forEach((h) => { try { h.stop(); } catch (_) {} });
        }
      } catch (_) {}
      // 2) Raw <audio> / <video> elements (TTS, preview, MediaRecorder refs).
      try {
        document.querySelectorAll('audio, video').forEach((el) => {
          try { el.pause(); el.currentTime = 0; } catch (_) {}
        });
      } catch (_) {}
      // 3) Close any surviving AudioContext so the OS releases the graph.
      try {
        const ctx = window.__effexiqAudioCtx || window.audioContext;
        if (ctx && typeof ctx.close === 'function' && ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch (_) {}
    };

    const onPageHide = () => killAll();
    const onPageShow = (e) => { if (e && e.persisted) killAll(); };
    // Extra: some mobile browsers only fire visibilitychange when backgrounded.
    const onVisibility = () => { if (document.hidden) killAll(); };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    // Also kill immediately on mount. If we just reloaded into a fresh
    // landing-page tree but a prior engine leaked audio, this catches it.
    killAll();

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
