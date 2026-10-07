import { missions as ALL, type Mission } from "./missions";
import type { Phase } from "./sun";
import type { SkyCondition } from "./weather";

export type PickInput = {
  phase: Phase;
  sky: SkyCondition | null; // null = unknown, only sky-agnostic missions
  moonUp?: boolean;
  recentIds?: string[]; // most recent first
  pool?: Mission[];
  rng?: () => number;
};

export function matches(
  m: Mission,
  phase: Phase,
  sky: SkyCondition | null,
  moonUp = false
) {
  const timeOk = m.time.includes("any") || m.time.includes(phase);
  const skyOk = m.sky.includes("any") || (sky !== null && m.sky.includes(sky));
  const needsOk = m.needs !== "moon" || moonUp;
  return timeOk && skyOk && needsOk;
}

// Specific missions (tied to a time or sky) are weighted above all-purpose ones
const weight = (m: Mission) =>
  1 + (m.time.includes("any") ? 0 : 1) + (m.sky.includes("any") ? 0 : 1);

export function pickMission({
  phase,
  sky,
  moonUp = false,
  recentIds = [],
  pool = ALL,
  rng = Math.random,
}: PickInput): Mission {
  const fits = pool.filter((m) => matches(m, phase, sky, moonUp));
  if (fits.length === 0) {
    return pool.find((m) => m.id === "far-point") ?? pool[0];
  }

  const fresh = fits.filter((m) => !recentIds.includes(m.id));
  const notLast = fits.filter((m) => m.id !== recentIds[0]);
  const candidates = fresh.length ? fresh : notLast.length ? notLast : fits;

  const total = candidates.reduce((s, m) => s + weight(m), 0);
  let r = rng() * total;
  for (const m of candidates) {
    r -= weight(m);
    if (r < 0) return m;
  }
  return candidates[candidates.length - 1];
}