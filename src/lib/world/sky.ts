import * as Astronomy from "astronomy-engine";
import { getMoonIllumination, getMoonPosition, getPosition } from "suncalc";
import { getDayTimes } from "./sun";

export const FACT_KEYS = [
  "sunrise_time",
  "sunset_time",
  "golden_hour_time",
  "dusk_time",
  "moon_phase",
  "moon_status",
  "planet_list",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];
export type SkyFacts = Record<FactKey, string>;

export type PlanetPos = {
  name: string;
  altitude: number;
  azimuth: number;
  direction: string;
};

const DEG = 180 / Math.PI;
const PLANETS = [
  Astronomy.Body.Venus,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
];
const DIRECTIONS = [
  "north", "north-east", "east", "south-east",
  "south", "south-west", "west", "north-west",
];
const MOON_NAMES = [
  "new moon", "waxing crescent", "first quarter", "waxing gibbous",
  "full moon", "waning gibbous", "last quarter", "waning crescent",
];

export const compass = (azimuth: number) =>
  DIRECTIONS[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];

export function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getMoon(date: Date, lat: number, lng: number) {
  const ill = getMoonIllumination(date);
  const pos = getMoonPosition(date, lat, lng);
  const altitude = pos.altitude * DEG;
  // SunCalc azimuth is measured from south toward west; convert to compass-from-north
  const azimuth = (pos.azimuth * DEG + 180) % 360;
  return {
    phase: MOON_NAMES[Math.round(ill.phase * 8) % 8],
    altitude,
    azimuth,
    up: altitude > 5,
  };
}

export function getVisiblePlanets(
  date: Date,
  lat: number,
  lng: number
): PlanetPos[] {
  const sunAlt = getPosition(date, lat, lng).altitude * DEG;
  if (sunAlt > -4) return []; // sky too bright

  const observer = new Astronomy.Observer(lat, lng, 0);
  const out: PlanetPos[] = [];

  for (const body of PLANETS) {
    const eq = Astronomy.Equator(body, date, observer, true, true);
    const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, "normal");
    if (hor.altitude >= 8) {
      out.push({
        name: String(body),
        altitude: hor.altitude,
        azimuth: hor.azimuth,
        direction: compass(hor.azimuth),
      });
    }
  }
  return out.sort((a, b) => b.altitude - a.altitude);
}

export function buildFacts(lat: number, lng: number, at: Date): SkyFacts {
  const d = getDayTimes(at, lat, lng);
  const moon = getMoon(at, lat, lng);
  const planets = getVisiblePlanets(at, lat, lng);

  return {
    sunrise_time: fmtTime(d.sunrise),
    sunset_time: fmtTime(d.sunset),
    golden_hour_time: fmtTime(d.goldenHour),
    dusk_time: fmtTime(d.dusk),
    moon_phase: moon.phase,
    moon_status: moon.up
      ? `${moon.phase}, ${Math.round(moon.altitude)}° up in the ${compass(moon.azimuth)}`
      : `${moon.phase}, below the horizon`,
    planet_list: planets.length
      ? planets
          .map((p) => `${p.name} (${Math.round(p.altitude)}° up, ${p.direction})`)
          .join(", ")
      : "no bright planets up",
  };
}