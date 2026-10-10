import { getMoonPosition } from "suncalc";
import type { Phase } from "../world/sun";
import type { SkyCondition } from "../world/weather";
import { putQueued, listQueue, pruneQueue, type QueuedMission } from "../db/db";
import { missions as STATIC } from "./missions";
import { validateGenerated } from "./validate";
import type { Slot } from "./slots";

export type GenSlot = {
  id: string;
  phase: Phase;
  sky: SkyCondition | null;
  moonUp: boolean;
  validFrom: number;
  validUntil: number;
};

const URL_ = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/missions`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function toGenSlot(s: Slot, lat: number, lng: number): GenSlot {
  return {
    id: s.id,
    phase: s.phase,
    sky: s.forecast?.sky ?? null,
    moonUp: getMoonPosition(new Date(s.at), lat, lng).altitude > 0,
    validFrom: s.start,
    validUntil: s.end,
  };
}

   async function callMissions(slot: GenSlot, avoid: string[]): Promise<unknown> {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
       console.warn("missions: NEXT_PUBLIC_SUPABASE_URL is not set");
       return null;
     }
     try {
       const res = await fetch(URL_, {
         method: "POST",
         headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
         body: JSON.stringify({ phase: slot.phase, sky: slot.sky ?? "any", moonUp: slot.moonUp, avoid }),
         signal: AbortSignal.timeout(25_000),
       });
       if (!res.ok) {
         console.warn("missions function failed:", res.status, await res.text().catch(() => ""));
         return null;
       }
       return (await res.json()).mission ?? null;
     } catch (e) {
       console.warn("missions call error:", e);
       return null;
     }
   }

async function fillQueueInner(slots: GenSlot[], max: number): Promise<number> {
  try {
    await pruneQueue();
    const queued = await listQueue();
    const have = new Set(queued.map((q) => q.slotId));
    const avoid = [...STATIC.map((m) => m.title), ...queued.map((q) => q.title)];
    let added = 0;

    for (const slot of slots) {
      if (added >= max) break;
      if (have.has(slot.id)) continue;

      const raw = await callMissions(slot, avoid.slice(-30));
      const v = validateGenerated(raw, { phase: slot.phase, sky: slot.sky, moonUp: slot.moonUp });
      if (!v.ok) {
        console.warn("generated mission rejected:", v.reason);
        continue;
      }

      const q: QueuedMission = {
        id: `gen-${slot.id}`,
        ...v.value,
        time: [slot.phase],
        sky: [slot.sky ?? "any"],
        ...(v.value.instruction.includes("{moon_status}") ? { needs: "moon" as const } : {}),
        slotId: slot.id,
        validFrom: slot.validFrom,
        validUntil: slot.validUntil,
        generated: true,
      };
      await putQueued(q);
      avoid.push(q.title);
      added++;
    }
    return added;
  } catch {
    return 0;
  }
}

let inFlight: Promise<number> | null = null;

export function fillQueue(slots: GenSlot[], max = 3): Promise<number> {
  inFlight ??= fillQueueInner(slots, max).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function activeQueued(now = Date.now()): Promise<QueuedMission[]> {
  try {
    return (await listQueue()).filter((q) => q.validFrom <= now && now <= q.validUntil);
  } catch {
    return [];
  }
}