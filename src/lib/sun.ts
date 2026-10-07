import {
  getTimes,
  getPosition,
  getMoonIllumination,
} from "suncalc";

export type Phase = "dawn" | "day" | "golden" | "dusk" | "night";

/**
 * Legacy: only knows minutes-to-sunset, so it can't tell dawn or pre-dawn
 * from daytime. Prefer getPhaseAt().
 */
export function getPhase(sunsetInMinutes: number | null): Phase {
  if (sunsetInMinutes === null) return "day"; // no sunset data: treat as plain daytime
  if (sunsetInMinutes > 90) return "day";
  if (sunsetInMinutes > 0) return "golden"; // up to 90 min before sunset
  if (sunsetInMinutes > -45) return "dusk"; // up to 45 min after
  return "night";
}

export function getDayTimes(date: Date, lat: number, lng: number) {
  const t = getTimes(date, lat, lng);
  return {
    dawn: t.dawn?.getTime() ?? NaN,
    sunrise: t.sunrise?.getTime() ?? NaN,
    goldenHourEnd: t.goldenHourEnd?.getTime() ?? NaN,
    goldenHour: t.goldenHour?.getTime() ?? NaN,
    sunset: t.sunset?.getTime() ?? NaN,
    dusk: t.dusk?.getTime() ?? NaN,
  };
}

export function getPhaseAt(date: Date, lat: number, lng: number): Phase {
  const t = date.getTime();
  const d = getDayTimes(date, lat, lng);

  // Polar regions: some of these times don't exist
  if (Object.values(d).some(Number.isNaN)) {
    return getPosition(date, lat, lng).altitude > 0 ? "day" : "night";
  }

  if (t < d.dawn || t >= d.dusk) return "night";
  if (t < d.goldenHourEnd) return "dawn";
  if (t < d.goldenHour) return "day";
  if (t < d.sunset) return "golden";
  return "dusk";
}

export function getSunInfo(lat: number, lng: number, now = new Date()) {
  const { sunset } = getTimes(now, lat, lng);
  const moonPhase = getMoonIllumination(now).phase; // 0 = new, 0.5 = full
  const phase = getPhaseAt(now, lat, lng);

  // No sunset on this date (polar regions), or an Invalid Date
  if (!sunset || Number.isNaN(sunset.getTime())) {
    return { sunsetInMinutes: null, sunsetBearing: null, moonPhase, phase };
  }

  const sunsetInMinutes = Math.round((sunset.getTime() - now.getTime()) / 60000);

  // SunCalc azimuth: radians, measured from SOUTH, increasing westward.
  const az = getPosition(sunset, lat, lng).azimuth;
  const sunsetBearing = ((az * 180) / Math.PI + 180) % 360; // compass degrees, 0 = north

  return { sunsetInMinutes, sunsetBearing, moonPhase, phase };
}