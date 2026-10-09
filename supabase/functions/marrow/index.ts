// Supabase Edge Function (Deno). The browser calls THIS; this calls Gemma.
// Why a proxy: the AI Studio key must never ship to the browser, where anyone could copy it.
//
// Deploy:  npx supabase secrets set GEMINI_API_KEY=your_key
//          npx supabase functions deploy marrow
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gemma-4-26b-a4b-it"; // use whatever model name worked in your PowerShell test
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Lock this to your real site once deployed, e.g. "https://look-up.vercel.app"
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** What just happened, in words the model can react to. Only these keys are accepted. */
const SITUATIONS: Record<string, string> = {
  greet: "The visitor just opened the app. Greet them warmly.",
  tap: "The visitor tapped you. Say something wise or cheerful about nature, sky or slowing down.",
  picked_up: "The visitor just picked you up and your feet are dangling. React with a startled, good-humoured grumble.",
  thrown: "The visitor flung you through the air and you are mid-flight. Shout something joyful and startled.",
  dropped: "You crash-landed on the grass and are seeing stars. Laugh it off with a gentle joke.",
};

/* ---------- Rate limiting (in memory: resets when the function cold-starts) ---------- */
const PER_IP_PER_MIN = 10;
const GLOBAL_PER_HOUR = 300; // protects your free quota no matter who calls
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

/** Only allow short, plain labels from the client. Anything else could be a prompt injection. */
const safeLabel = (v: unknown) => (typeof v === "string" && /^[a-z0-9 _-]{1,24}$/i.test(v) ? v : "unknown");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS }); // CORS preflight
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return json({ error: "slow down" }, 429);

  let body: { event?: string; phase?: string; sky?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

const situation =
  typeof body.event === "string" && Object.hasOwn(SITUATIONS, body.event)
    ? SITUATIONS[body.event]
    : undefined;
  if (!situation) return json({ error: "unknown event" }, 400);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "server not configured" }, 500);

  // Everything goes in one user message (some Gemma versions reject a separate system prompt).
  const prompt = [
    "You are Old Marrow, a calm, jolly elderly gardener who has seen a lot of life.",
    "You are warm, wise, gently funny, and love nature and slowing down.",
    "Reply with ONE short sentence, at most 14 words. Plain text only: no quotes, no emoji, no hashtags, no stage directions.",
    `Time of day: ${safeLabel(body.phase)}. Sky: ${safeLabel(body.sky)}.`,
    `Situation: ${situation}`,
  ].join("\n");

  const upstream = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Reasoning tokens count against this limit, so keep it roomy.
      generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
    }),
  });

  if (!upstream.ok) {
    console.error("gemma error", upstream.status, await upstream.text());
    return json({ error: "model unavailable" }, 502);
  }

  // The reply can contain a reasoning part first. The answer is the LAST non-thought part.
  const data = await upstream.json();
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const raw = [...parts].reverse().find((p) => !p.thought && p.text?.trim())?.text ?? "";

  const line = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/[*_`#"“”]/g, "")
    .trim()
    .slice(0, 140);

  if (!line) return json({ error: "empty reply" }, 502);
  return json({ line });
});