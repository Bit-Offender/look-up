import { describe, expect, it } from "vitest";
import { extractPlaceholders, fill } from "./fill";
import { missions } from "./missions";
import { matches, pickMission } from "./pickMission";
import { FACT_KEYS, buildFacts, getVisiblePlanets } from "./sky";
import { buildSlots } from "./slots";
import { getDayTimes, getPhaseAt, type Phase } from "./sun";
import { classifySky } from "./weather";

const LAT = 20.3;
const LNG = 85.8;
const NOON = new Date("2026-10-07T06:30:00Z");

describe("phases", () => {
  it("follow sun times in order", () => {
    const d = getDayTimes(NOON, LAT, LNG);
    const at = (ms: number) => getPhaseAt(new Date(ms), LAT, LNG);
    expect(at(d.dawn - 60_000)).toBe("night");
    expect(at(d.dawn + 60_000)).toBe("dawn");
    expect(at(d.goldenHourEnd + 60_000)).toBe("day");
    expect(at(d.goldenHour + 60_000)).toBe("golden");
    expect(at(d.sunset + 60_000)).toBe("dusk");
    expect(at(d.dusk + 60_000)).toBe("night");
  });
});

describe("weather classification", () => {
  it("handles rain, cloud, and forecast probability", () => {
    expect(classifySky(10, 0, 0, false)).toBe("clear");
    expect(classifySky(80, 0, 0, false)).toBe("cloudy");
    expect(classifySky(10, 0.2, 0, false)).toBe("rain");
    expect(classifySky(10, 0, 80, false)).toBe("clear");
    expect(classifySky(10, 0, 80, true)).toBe("rain");
  });
});

describe("fill", () => {
  it("substitutes known keys and throws on unknown ones", () => {
    expect(fill("at {sunset_time}", { sunset_time: "6:04 pm" })).toBe("at 6:04 pm");
    expect(() => fill("{venus_altitude}", {})).toThrow();
  });
});

describe("missions", () => {
  it("only use known placeholders", () => {
    for (const m of missions) {
      for (const key of extractPlaceholders(m.instruction)) {
        expect(FACT_KEYS as readonly string[]).toContain(key);
      }
    }
  });

  it("every phase x sky x moon combination has at least 2 options", () => {
    const phases: Phase[] = ["dawn", "day", "golden", "dusk", "night"];
    for (const phase of phases) {
      for (const sky of ["clear", "cloudy", "rain"] as const) {
        for (const moonUp of [true, false]) {
          const n = missions.filter((m) => matches(m, phase, sky, moonUp)).length;
          expect(n, `${phase}/${sky}/moon:${moonUp}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("pickMission avoids the last mission when it can", () => {
    const first = pickMission({ phase: "day", sky: "clear", rng: () => 0 });
    const next = pickMission({
      phase: "day",
      sky: "clear",
      recentIds: [first.id],
      rng: () => 0,
    });
    expect(next.id).not.toBe(first.id);
  });
});

describe("slots", () => {
  const now = new Date("2026-10-07T10:00:00Z");
  const slots = buildSlots(LAT, LNG, now);

  it("are future, sorted, unique", () => {
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.end > now.getTime())).toBe(true);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].start).toBeGreaterThanOrEqual(slots[i - 1].start);
    }
  });

  it("carry every fact key", () => {
    for (const s of slots) {
      for (const k of FACT_KEYS) expect(s.facts[k]).toBeTruthy();
    }
  });
});

describe("planets", () => {
  it("returns none in broad daylight", () => {
    expect(getVisiblePlanets(NOON, LAT, LNG)).toEqual([]);
    expect(buildFacts(LAT, LNG, NOON).planet_list).toBe("no bright planets up");
  });
});