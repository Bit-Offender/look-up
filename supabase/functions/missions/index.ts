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
const SKIES = ["clear", "cloudy", "rain", "any"];

const PER_IP_PER_MIN = 8;
const GLOBAL_PER_HOUR = 200;
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

const safeLabel = (v: unknown) =>
  typeof v === "string" && /^[a-z0-9 _-]{1,24}$/i.test(v) ? v : "unknown";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return json({ error: "slow down" }, 429);

  let body: { phase?: string; sky?: string; moonUp?: boolean; avoid?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  if (!PHASES.includes(body.phase ?? "")) return json({ error: "bad phase" }, 400);
  if (!SKIES.includes(body.sky ?? "")) return json({ error: "bad sky" }, 400);
  const moonUp = body.moonUp === true;
  const avoid: string[] = Array.isArray(body.avoid)
    ? body.avoid.slice(0, 30).map((t: unknown) => safeLabel(t)).filter((t: string) => t !== "unknown")
    : [];

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "server not configured" }, 500);

  const prompt = [
    "You write tiny outdoor missions for an app that gets people to look up and put their phone away.",
    `Time of day: ${body.phase}. Sky: ${body.sky}. Moon visible: ${moonUp ? "yes" : "no"}.`,
    'Return ONLY a JSON object: {"title": string, "instruction": string, "min": integer}',
    "Rules:",
    "- title: two or three words, letters and spaces only, at most 24 characters.",
    "- instruction: one or two short imperative sentences, 20 to 180 characters. Something to notice with eyes and ears. Safe, no equipment.",
    "- min: minutes it takes, an integer from 2 to 10. This is the ONLY place digits are allowed. Write every other number as a word.",
    "- Never mention phones, apps, screens, photos or cameras. Never invent times, dates or moon phases.",
    "- You may use the literal placeholder {sunset_time} only if time of day is golden or dusk, and {moon_status} only if the moon is visible.",
    `- Do not reuse these ideas: ${avoid.join(", ") || "none"}`,
  ].join("\n");

  // No JSON mode: Google returned 500 INTERNAL with it on. The prompt asks for JSON only and
  // the parsing below strips code fences and extra words, so plain text mode is safe.
  // Reasoning tokens count against maxOutputTokens, so keep it roomy (1024 truncated the JSON).
  const request = () =>
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(14_000),
    });

  let upstream: Response;
  try {
    upstream = await request();
    if (upstream.status >= 500) {
      console.error("gemma 5xx, retrying once", upstream.status, await upstream.text());
      upstream = await request(); // Google's 500s are often transient
    }
  } catch {
    return json({ error: "model timeout" }, 504);
  }

  if (!upstream.ok) {
    console.error("gemma error", upstream.status, await upstream.text());
    return json({ error: "model unavailable" }, 502);
  }

  const data = await upstream.json();
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const raw = [...parts].reverse().find((p) => !p.thought && p.text?.trim())?.text ?? "";
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  // If the model wrapped the JSON in extra words, take the outermost {...}.
  const candidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;

  try {
    return json({ mission: JSON.parse(candidate) });
  } catch {
    console.error("bad model json", data?.candidates?.[0]?.finishReason, raw.slice(0, 300));
    return json({ error: "bad model json" }, 502);
  }
});