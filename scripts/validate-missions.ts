/**
 * Validates /missions/*.json and bundles them into src/lib/missions/missions.generated.json.
 *
 *   npm run missions          validate + write the bundle
 *   npm run missions:check    validate + fail if the bundle is stale (used in CI)
 *
 * Placeholder keys come from the app itself (ALLOWED_KEYS / extractPlaceholders),
 * so this script can never drift from what fill() accepts.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ALLOWED_KEYS } from "../src/lib/missions/validate";
import { extractPlaceholders } from "../src/lib/missions/fill";
import type { Mission } from "../src/lib/missions/missions";
import type { Phase } from "../src/lib/world/sun";
import type { SkyCondition } from "../src/lib/world/weather";

// `satisfies` makes tsc complain if one of these stops being a real Phase / SkyCondition.
const PHASES = ["dawn", "day", "golden", "dusk", "night"] as const satisfies readonly Phase[];
const SKIES = ["clear", "cloudy", "rain"] as const satisfies readonly SkyCondition[];

const DIR = join(process.cwd(), "missions");
const OUT = join(process.cwd(), "src", "lib", "missions", "missions.generated.json");
const KEYS = new Set(["$schema", "id", "title", "time", "sky", "instruction", "min", "needs"]);
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TITLE_RE = /^[A-Za-z][A-Za-z -]{2,23}$/; // same rule as validateGenerated

const errors: string[] = [];
const err = (file: string, msg: string) => errors.push(`${file}: ${msg}`);

function checkList(file: string, label: "time" | "sky", v: unknown, allowed: readonly string[]) {
  if (!Array.isArray(v) || v.length === 0) return err(file, `${label} must be a non-empty array`);
  const seen = new Set<string>();
  for (const x of v) {
    if (x !== "any" && !allowed.includes(x as string))
      err(file, `${label} has invalid value ${JSON.stringify(x)} (allowed: any, ${allowed.join(", ")})`);
    else if (seen.has(x)) err(file, `${label} has duplicate "${x}"`);
    seen.add(x as string);
  }
  if (seen.has("any") && v.length > 1) err(file, `${label}: "any" must be the only entry`);
}

function validate(file: string, data: unknown): Mission | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    err(file, "must be a JSON object");
    return null;
  }
  const m = data as Record<string, unknown>;
  const before = errors.length;

  for (const k of Object.keys(m)) if (!KEYS.has(k)) err(file, `unknown key "${k}"`);

  const expectedId = file.replace(/\.json$/, "");
  if (typeof m.id !== "string" || !ID_RE.test(m.id)) err(file, "id must be kebab-case");
  else if (m.id !== expectedId) err(file, `id "${m.id}" must match the filename "${expectedId}"`);

  if (typeof m.title !== "string" || !TITLE_RE.test(m.title))
    err(file, "title must be 3-24 chars: letters, spaces, hyphens, starting with a letter");

  checkList(file, "time", m.time, PHASES);
  checkList(file, "sky", m.sky, SKIES);

  if (m.needs !== undefined && m.needs !== "moon") err(file, 'needs must be "moon" if present');

  if (!Number.isInteger(m.min) || (m.min as number) < 2 || (m.min as number) > 10)
    err(file, "min must be an integer from 2 to 10");

  if (typeof m.instruction !== "string") err(file, "instruction must be a string");
  else {
    const t = m.instruction;
    if (t !== t.trim()) err(file, "instruction has leading/trailing whitespace");
    if (t.length < 20 || t.length > 200) err(file, `instruction must be 20-200 characters (got ${t.length})`);
    if (/[\r\n]/.test(t)) err(file, "instruction must be a single line");
    const keys = extractPlaceholders(t);
    for (const k of keys)
      if (!ALLOWED_KEYS.includes(k)) err(file, `unknown placeholder {${k}} (allowed: ${ALLOWED_KEYS.join(", ")})`);
    if (/[{}<>]/.test(t.replace(/\{[a-z_]+\}/g, ""))) err(file, 'stray "{", "}", "<" or ">" in instruction');

    // A fact must only ever appear when it is true. pickMission can't check this for us.
    if (keys.includes("sunset_time") && Array.isArray(m.time) && !m.time.every((p) => p === "golden" || p === "dusk"))
      err(file, '{sunset_time} needs time to be only "golden" and/or "dusk"');
    if (keys.includes("moon_status") && m.needs !== "moon")
      err(file, '{moon_status} needs "needs": "moon", otherwise it can show while the moon is down');
  }

  return errors.length === before ? (m as unknown as Mission) : null;
}

function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "schema.json").sort();
  const out: Mission[] = [];
  const ids = new Map<string, string>();
  const titles = new Map<string, string>();

  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    } catch (e) {
      err(file, `invalid JSON (${(e as Error).message})`);
      continue;
    }
    const m = validate(file, data);
    if (!m) continue;
    if (ids.has(m.id)) err(file, `duplicate id (also in ${ids.get(m.id)})`);
    if (titles.has(m.title.toLowerCase())) err(file, `duplicate title "${m.title}" (also in ${titles.get(m.title.toLowerCase())})`);
    ids.set(m.id, file);
    titles.set(m.title.toLowerCase(), file);

    // Fixed key order so the bundle diff is stable.
    const clean: Mission = { id: m.id, title: m.title, time: m.time, sky: m.sky, instruction: m.instruction, min: m.min };
    if (m.needs) clean.needs = m.needs;
    out.push(clean);
  }

  // pickMission falls back to this one when nothing fits.
  const fb = out.find((m) => m.id === "far-point");
  if (!fb || fb.time[0] !== "any" || fb.sky[0] !== "any")
    errors.push('missions: "far-point" must exist with time ["any"] and sky ["any"] (pickMission fallback)');

  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n`);
    for (const e of errors) console.error(`  x ${e}`);
    console.error("");
    process.exit(1);
  }

  console.log(`ok: ${out.length} missions valid`);

  // Coverage: which phase x sky combos have no dedicated mission? Good first issues.
  const gaps: string[] = [];
  for (const p of PHASES)
    for (const s of SKIES) {
      const n = out.filter((m) => m.id !== "far-point" && (m.time[0] === "any" || m.time.includes(p)) && (m.sky[0] === "any" || m.sky.includes(s))).length;
      if (n === 0) gaps.push(`${p}/${s}`);
    }
  if (gaps.length) console.log(`note: no mission besides the fallback for: ${gaps.join(", ")}`);

  const json = JSON.stringify(out, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== json) {
      console.error("missions.generated.json is stale. Run: npm run missions");
      process.exit(1);
    }
    console.log("ok: bundle is up to date");
  } else {
    writeFileSync(OUT, json);
    console.log(`wrote ${OUT}`);
  }
}

main();