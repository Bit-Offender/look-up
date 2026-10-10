import { extractPlaceholders } from "./fill";
import type { Mission } from "./missions";
import type { Phase } from "../world/sun";
import type { SkyCondition } from "../world/weather";

/** Swap for your FACT_KEYS if it exports these. */
export const ALLOWED_KEYS: readonly string[] = ["sunset_time", "moon_status"];

const BAD_TOPICS =
  /\b(phone|app|screen|photo|picture|camera|selfie|scroll|drive|driving|climb|swim|trespass|stare)\b|\bat the sun\b/i;

export type GenContext = { phase: Phase; sky: SkyCondition | null; moonUp: boolean };
export type Generated = Pick<Mission, "title" | "instruction" | "min">;
export type Result = { ok: true; value: Generated } | { ok: false; reason: string };

export function validateGenerated(raw: unknown, ctx: GenContext): Result {
  const bad = (reason: string): Result => ({ ok: false, reason });
  if (typeof raw !== "object" || raw === null) return bad("not an object");
  const { title, instruction, min } = raw as Record<string, unknown>;

  if (typeof title !== "string" || !/^[A-Za-z][A-Za-z -]{2,23}$/.test(title.trim()))
    return bad("title");
  if (typeof instruction !== "string") return bad("instruction type");

  const text = instruction.trim();
  if (text.length < 20 || text.length > 200) return bad("instruction length");
  if (/[\r\n]/.test(text)) return bad("multiline");
  if (/\d/.test(text)) return bad("digits in instruction");

  const keys = extractPlaceholders(text);
  if (keys.some((k) => !ALLOWED_KEYS.includes(k))) return bad("unknown placeholder");
  if (/[{}<>]/.test(text.replace(/\{[a-z_]+\}/g, ""))) return bad("stray braces");
  if (keys.includes("sunset_time") && ctx.phase !== "golden" && ctx.phase !== "dusk")
    return bad("sunset_time out of phase");
  if (keys.includes("moon_status") && !ctx.moonUp) return bad("moon_status without moon");
  if (BAD_TOPICS.test(text)) return bad("off-topic or unsafe");

  if (typeof min !== "number" || !Number.isInteger(min) || min < 2 || min > 10)
    return bad("min");

  return { ok: true, value: { title: title.trim(), instruction: text, min } };
}