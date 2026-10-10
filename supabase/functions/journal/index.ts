// Supabase Edge Function (Deno). The browser sends ONE small photo; this asks Gemma to write
// a field-journal entry about it. The AI Studio key stays here, never in the browser.
//
// Deploy:  npx supabase functions deploy journal --no-verify-jwt
// (uses the same GEMINI_API_KEY secret as marrow and missions)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gemma-4-26b-a4b-it";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PHASES = ["dawn", "day", "golden", "dusk", "night"];
// The client downscales to ~768px JPEG (about 100 KB, ~140k base64 chars). Anything far bigger is not ours.
const MAX_IMAGE_CHARS = 400_000;

/* ---------- Rate limiting (in memory, resets on cold start) ---------- */
const PER_IP_PER_MIN = 5;
const GLOBAL_PER_HOUR = 120;
const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

function limited(ip: string): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < 3_600_000);
  const mine = (ipHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= PER_IP_PER_MIN || globalHits.length >= GLOBAL_PER_HOUR) {
    if (mine.length) ipHits.set(ip, mine); else ipHits.delete(ip);
    return true;
  }
  mine.push(now);
  globalHits.push(now);
  ipHits.set(ip, mine);
  return false;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Only short plain labels from the client reach the prompt. Anything else could be a prompt injection. */
const safeLabel = (v: unknown) => (typeof v === "string" && /^[a-z0-9 _-]{1,24}$/i.test(v) ? v : "unknown");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return json({ error: "slow down" }, 429);

  let body: { image?: unknown; missionTitle?: unknown; phase?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const image = body.image;
  if (
    typeof image !== "string" ||
    image.length < 100 ||
    image.length > MAX_IMAGE_CHARS ||
    !image.startsWith("/9j/") || // every JPEG starts with these bytes
    !/^[A-Za-z0-9+/]+={0,2}$/.test(image)
  ) {
    return json({ error: "bad image" }, 400);
  }

  const title = safeLabel(body.missionTitle);
  const phase = typeof body.phase === "string" && PHASES.includes(body.phase) ? body.phase : "unknown";

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "server not configured" }, 500);

  const prompt = [
    "You are helping write one entry in a person's outdoor field journal.",
    "They just spent a few minutes outside with their phone away, on a small mission, then took the photo above.",
    `Mission: ${title}. Time of day: ${phase}.`,
    "Write the entry in first person, past tense, two to four sentences, under 70 words, in a calm, observant voice.",
    "Describe only what is actually visible in the photo (sky, light, clouds, plants, ground, water, buildings) and small sensory details that plausibly go with it.",
    "Never invent weather, times, places, names or events the photo does not support.",
    "If the photo is too dark, blurry, indoors or shows a screen, write one gentle sentence about what you can see and stop.",
    "Do not describe or identify any person's face.",
    "Plain text only: no title, no quotes, no emoji, no hashtags, no lists.",
  ].join("\n");

  // Image calls are slower than text calls, so allow up to ~55 s in total (the client waits 60 s).
  // Retry once, but only on a 5xx or a network failure and only if enough time is left.
  const requestBody = JSON.stringify({
    // Image first, then the text, as the Gemini docs recommend for a single image.
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: prompt }] }],
    // Reasoning tokens count against this limit, so keep it roomy.
    generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
  });
  const started = Date.now();
  console.log(`journal: calling gemma, image ${Math.round(image.length / 1024)} KB (base64)`);
  let upstream: Response | undefined;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = 55_000 - (Date.now() - started);
    if (left < 10_000) break;
    try {
      upstream = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: requestBody,
        signal: AbortSignal.timeout(Math.min(40_000, left)),
      });
      if (upstream.status < 500 || attempt === 1) break;
      lastError = `status ${upstream.status}`;
      console.error("gemma 5xx, retrying once", upstream.status, await upstream.text());
      upstream = undefined;
    } catch (e) {
      const err = e as Error;
      lastError = `${err.name}: ${err.message}`;
      console.error("gemma fetch failed:", lastError, "after", Date.now() - started, "ms");
      upstream = undefined;
    }
  }
  if (!upstream) return json({ error: "model unreachable", detail: lastError }, 504);

  if (!upstream.ok) {
    console.error("gemma error", upstream.status, await upstream.text());
    return json({ error: "model unavailable" }, 502);
  }

  // The reply can contain a reasoning part first. The answer is the LAST non-thought part.
  const data = await upstream.json();
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const raw = [...parts].reverse().find((p) => !p.thought && p.text?.trim())?.text ?? "";

  let entry = raw
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/[*_`#"“”]/g, "")
    .trim();
  if (entry.length > 600) {
    const cut = entry.slice(0, 600);
    entry = cut.slice(0, Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?")) + 1) || cut;
  }

  if (!entry) {
    console.error("empty reply", data?.candidates?.[0]?.finishReason, JSON.stringify(data?.promptFeedback ?? {}));
    return json({ error: "empty reply" }, 502);
  }
  console.log(`journal: ok in ${Date.now() - started} ms, ${entry.length} chars`);
  return json({ entry });
});