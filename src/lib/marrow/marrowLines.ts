/**
 * Where Marrow's words come from.
 *
 * Problem: Gemma takes seconds to answer, but a reaction (he's picked up!) must feel instant.
 * Solution: a prefetch buffer. In the background we keep 1-2 Gemma-written lines ready per event.
 * When something happens we pop a ready line instantly; if the buffer is empty we use a
 * hand-written fallback. The app never waits on the network and never breaks if it fails.
 */

export type MarrowEvent = "greet" | "tap" | "picked_up" | "thrown" | "dropped";
export type Facts = { phase: string; sky?: string };

const STATIC: Record<MarrowEvent, string[]> = {
  greet: [
    "Ah, there you are. The sky's been waiting.",
    "Hello, friend! Perfect day for a little looking-up.",
  ],
  tap: [
    "Sixty years of sunsets and I still stop for every one.",
    "A puddle is just the sky lying down for a rest.",
    "Slow feet see more. Trust me, I've got the miles.",
    "Birds never hurry, and they still get everywhere.",
    "Moss has never rushed a day, and look how well it's doing.",
    "Worries shrink out under a big sky. Funny, that.",
  ],
  picked_up: [
    "Whoa! Easy now, my knees aren't what they were!",
    "Ha! Put me down, you rascal!",
    "Up we go! Mind the hat!",
  ],
  thrown: ["Wheeeee!", "I'm flying! Tell the birds I said hello!", "Not the hat, not the hat!"],
  dropped: [
    "Oof... good to know the ground is still there.",
    "I meant to do that. Mostly.",
    "Ow... ha! Seeing stars, and it isn't even night.",
  ],
};

const EVENTS = Object.keys(STATIC) as MarrowEvent[];
const buffers = Object.fromEntries(EVENTS.map((e) => [e, [] as string[]])) as Record<MarrowEvent, string[]>;
const inflight = new Set<MarrowEvent>();
const TARGET = 2; // lines kept ready per event

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ENABLED = Boolean(SUPABASE_URL && KEY);

let pausedUntil = 0; // after a failure (e.g. rate limited) stop calling for a minute

async function fetchLine(event: MarrowEvent, facts: Facts): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/marrow`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}`, apikey: KEY! },
    body: JSON.stringify({ event, phase: facts.phase, sky: facts.sky }),
    signal: AbortSignal.timeout(20_000), // never hang forever
  });
  if (!res.ok) throw new Error(`marrow function ${res.status}`);
  const data = (await res.json()) as { line?: unknown };
  return typeof data.line === "string" && data.line.trim() ? data.line.trim() : null;
}

async function refill(event: MarrowEvent, facts: Facts) {
  if (!ENABLED || Date.now() < pausedUntil) return;
  if (inflight.has(event) || buffers[event].length >= TARGET) return;

  inflight.add(event);
  try {
    const line = await fetchLine(event, facts);
    if (line) buffers[event].push(line);
  } catch {
    pausedUntil = Date.now() + 60_000;
  } finally {
    inflight.delete(event);
  }
}

/** Instant. Returns a Gemma line if one is ready, else a fallback, and tops the buffer up. */
export function getLine(event: MarrowEvent, facts: Facts): string {
  const ready = buffers[event].shift();
  void refill(event, facts);
  if (ready) return ready;
  const pool = STATIC[event];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Call once on mount. Only the common events, to go easy on your free quota. */
export function warmUp(facts: Facts) {
  void refill("greet", facts);
  void refill("tap", facts);
}