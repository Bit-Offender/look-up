import { getDayTimes, type Phase } from "./sun";
import { buildFacts, type SkyFacts } from "./sky";
import { skyAt, type Forecast, type SkyCondition } from "./weather";

export type Slot = {
  id: string;
  phase: Phase;
  start: number;
  end: number;
  at: number; // time the facts are computed for (slot midpoint)
  facts: SkyFacts;
  forecast: { sky: SkyCondition; cloudCover: number } | null;
};

const HOUR = 3_600_000;

export function buildSlots(
  lat: number,
  lng: number,
  now = new Date(),
  forecast?: Forecast,
  horizonHours = 36
): Slot[] {
  const nowMs = now.getTime();
  const slots: Slot[] = [];

  for (let day = 0; day <= 2; day++) {
    const t = getDayTimes(new Date(nowMs + day * 24 * HOUR), lat, lng);
    const windows: [Phase, number, number][] = [
      ["dawn", t.dawn, t.goldenHourEnd],
      ["day", t.goldenHourEnd, t.goldenHour],
      ["golden", t.goldenHour, t.sunset],
      ["dusk", t.sunset, t.dusk],
      ["night", t.dusk, t.dusk + 3 * HOUR],
    ];

    for (const [phase, start, end] of windows) {
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      if (end <= nowMs || start - nowMs > horizonHours * HOUR) continue;

      const at = start + (end - start) / 2;
      const sky = forecast ? skyAt(forecast, at) : null;

      slots.push({
        id: `${phase}-${new Date(start).toISOString().slice(0, 13)}`,
        phase,
        start,
        end,
        at,
        facts: buildFacts(lat, lng, new Date(at)),
        forecast: sky ? { sky: sky.sky, cloudCover: sky.cloudCover } : null,
      });
    }
  }
  return slots.sort((a, b) => a.start - b.start);
}