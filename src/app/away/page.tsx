'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_MISSION, useActiveMission } from '@/lib/missions/activeMissions';

type MarrowEvent = 'greet' | 'tap' | 'picked_up' | 'thrown' | 'dropped';
type Phase = 'ready' | 'away' | 'done';

// ---- config -------------------------------------------------------------
const MARROW_URL = process.env.NEXT_PUBLIC_MARROW_URL ?? ''; // Supabase Edge Function URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const EVENT_COOLDOWN_MS = 8000; // server allows 10/min per IP; stay well under

// Motion thresholds (m/s^2). Heuristics: tune on a real phone.
const G = 9.8;
const FREEFALL_MAX = 2.5; // magnitude below this = weightless
const IMPACT_MIN = 15; // spike at the end of a fall
const STILL_DEV = 0.5; // |m - G| below this counts as resting
const MOVE_DEV = 2; // |m - G| above this after resting = picked up
const STILL_BEFORE_PICKUP_MS = 6000;
const DROP_MIN_MS = 120;
const THROW_MIN_MS = 600;

const FALLBACK_LINES: Record<MarrowEvent, string[]> = {
  greet: ['Pocket it. The sky is doing fine without you.', 'Right. Phone down. Look about.'],
  tap: ['Not me you want. Up there.', 'Poking it won’t grow anything.'],
  picked_up: ['Already? Put it back.', 'I saw that.'],
  thrown: ['Whoa. Easy with the thing.', 'That’s one way to get rid of it.'],
  dropped: ['Ah. Gravity. Still works.', 'Pick it up gently, then forget it again.'],
};

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

async function askMarrow(event: MarrowEvent): Promise<string> {
  if (MARROW_URL) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000); // hosted Gemma is ~10 s/call
      const res = await fetch(MARROW_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Supabase gateways expect these when JWT verification is on.
          ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}),
        },
        body: JSON.stringify({ event }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        const line = data.line ?? data.text ?? data.message;
        if (typeof line === 'string' && line.trim()) return line.trim();
      } else {
        console.warn('marrow function failed:', res.status);
      }
    } catch {}
  }
  return pick(FALLBACK_LINES[event]); // offline, rate-limited or slow: static line
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function AwayPage() {
  const [phase, setPhase] = useState<Phase>('ready');
  const mission = useActiveMission();
  const [secondsLeft, setRemaining] = useState<number | null>(null); // null until started
  const remaining = secondsLeft ?? mission.minutes * 60;
  const [line, setLine] = useState('');
  const [denied, setDenied] = useState(false);

  const endAt = useRef(0);
  const lastFire = useRef(0);
  const freefallStart = useRef<number | null>(null);
  const stillSince = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const fire = useCallback(async (event: MarrowEvent) => {
    const now = performance.now();
    if (event !== 'greet' && now - lastFire.current < EVENT_COOLDOWN_MS) return;
    lastFire.current = now;
    setLine(await askMarrow(event));
  }, []);

  // Motion detection (only while away)
  useEffect(() => {
    if (phase !== 'away') return;

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const m = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      const now = performance.now();

      // Fall / throw: weightless, then (maybe) an impact spike
      if (m < FREEFALL_MAX) {
        if (freefallStart.current === null) freefallStart.current = now;
        return;
      }
      if (freefallStart.current !== null) {
        const d = now - freefallStart.current;
        freefallStart.current = null;
        if (d >= THROW_MIN_MS) return void fire('thrown');
        if (d >= DROP_MIN_MS && m >= IMPACT_MIN) return void fire('dropped');
      }

      // Pick-up: rested for a while, then clearly moved
      const dev = Math.abs(m - G);
      if (dev < STILL_DEV) {
        if (stillSince.current === null) stillSince.current = now;
      } else if (dev > MOVE_DEV && stillSince.current !== null) {
        if (now - stillSince.current > STILL_BEFORE_PICKUP_MS) fire('picked_up');
        stillSince.current = null;
      }
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [phase, fire]);

  // Countdown (based on a wall-clock end time, so throttled tabs stay accurate)
  useEffect(() => {
    if (phase !== 'away') return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setPhase('done');
        navigator.vibrate?.([200, 100, 200]);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Screen wake lock while away (re-acquired when the tab becomes visible again)
  useEffect(() => {
    if (phase !== 'away') return;
    const acquire = async () => {
      try {
        wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {}
    };
    acquire();
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [phase]);

  const start = async () => {
    // iOS needs an explicit permission prompt from a user gesture
    const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
    if (typeof DME.requestPermission === 'function') {
      try {
        if ((await DME.requestPermission()) !== 'granted') setDenied(true);
      } catch {
        setDenied(true);
      }
    }
    endAt.current = Date.now() + mission.minutes * 60 * 1000;
    setRemaining(mission.minutes * 60);
    setPhase('away');
    fire('greet');
  };

  if (phase === 'ready') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-black px-6 text-center text-neutral-200">
        <p className="text-sm uppercase tracking-widest text-neutral-500">
          {mission.id === DEFAULT_MISSION.id ? 'Your mission' : mission.title}
        </p>
        <p className="max-w-md text-2xl leading-snug">{mission.text}</p>
        <p className="text-neutral-500">{mission.minutes} minutes. Then come back.</p>
        <button
          onClick={start}
          className="rounded-full bg-amber-200 px-8 py-4 text-lg font-medium text-black active:scale-95"
        >
          Put the phone away
        </button>
        <Link href="/" className="text-sm text-neutral-600 underline">
          Not now
        </Link>
      </main>
    );
  }

  if (phase === 'done') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black px-6 text-center text-neutral-200">
        <p className="text-2xl">Welcome back.</p>
        <p className="max-w-sm text-neutral-500">Take a photo of what you saw and Marrow will help write it down.</p>
        <Link href="/journal/new" className="rounded-full bg-amber-200 px-8 py-4 text-lg font-medium text-black">
          Add to the journal
        </Link>
        <Link href="/" className="text-sm text-neutral-600 underline">
          Skip
        </Link>
      </main>
    );
  }

  // phase === 'away': near-black, low contrast, tap anywhere pokes Marrow
  return (
    <main
      onClick={() => fire('tap')}
      className="flex min-h-dvh select-none flex-col items-center justify-between bg-black px-6 py-12 text-center"
    >
      <p className="text-sm text-neutral-700">Look up.</p>
      <p className="max-w-xs text-xl leading-relaxed text-amber-200/60 transition-opacity duration-700">
        {line || ' '}
      </p>
      <p className="font-mono text-4xl tabular-nums text-neutral-800">{fmt(remaining)}</p>
      {denied && <p className="absolute bottom-3 text-xs text-neutral-700">Motion access denied: pick-up detection is off.</p>}
    </main>
  );
}
