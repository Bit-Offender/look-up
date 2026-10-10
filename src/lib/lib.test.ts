import { describe, expect, it } from "vitest";
import { extractPlaceholders, fill } from "./missions/fill";
import { missions } from "./missions/missions";
import { matches, pickMission } from "./missions/pickMission";
import { FACT_KEYS, buildFacts, getVisiblePlanets } from "./world/sky";
import { buildSlots } from "./missions/slots";
import { getDayTimes, getPhaseAt, type Phase } from "./world/sun";
import { classifySky } from "./world/weather";
import { validateGenerated } from "./missions/validate";

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

describe("validateGenerated", () => {
  const ctx = { phase: "dusk", sky: "clear", moonUp: true } as const;
  const good = {
    title: "Window Glow",
    instruction: "Find the first lit window. Watch until one more joins it.",
    min: 5,
  };

  it("accepts a good mission", () => expect(validateGenerated(good, ctx).ok).toBe(true));
  it("rejects digits", () =>
    expect(validateGenerated({ ...good, instruction: "Watch the sky for 5 minutes and count stars." }, ctx).ok).toBe(false));
  it("rejects unknown placeholders", () =>
    expect(validateGenerated({ ...good, instruction: "Count {star_count} stars before you leave." }, ctx).ok).toBe(false));
  it("rejects moon_status when the moon is down", () =>
    expect(validateGenerated({ ...good, instruction: "Tonight's moon: {moon_status}. Find it above the trees." }, { ...ctx, moonUp: false }).ok).toBe(false));
  it("rejects phone talk", () =>
    expect(validateGenerated({ ...good, instruction: "Take a photo of the best cloud you can find." }, ctx).ok).toBe(false));
  it("rejects garbage", () => {
    expect(validateGenerated("lol", ctx).ok).toBe(false);
    expect(validateGenerated(null, ctx).ok).toBe(false);
  });
});