import { getTimes, getPosition, getMoonIllumination } from "suncalc";

export type Phase = "day" | "golden" | "dusk" | "night";

export function getPhase(sunsetInMinutes: number | null): Phase {
  if (sunsetInMinutes === null) return "day";   // no sunset data: treat as plain daytime
  if (sunsetInMinutes > 90) return "day";
  if (sunsetInMinutes > 0) return "golden";     // up to 90 min before sunset
  if (sunsetInMinutes > -45) return "dusk";     // up to 45 min after
  return "night";
}

export function getSunInfo(lat: number, lng: number, now = new Date()) {
  const { sunset } = getTimes(now, lat, lng);
  const moonPhase = getMoonIllumination(now).phase; // 0 = new, 0.5 = full

  // No sunset on this date (polar regions), or an Invalid Date
  if (!sunset || Number.isNaN(sunset.getTime())) {
    return { sunsetInMinutes: null, sunsetBearing: null, moonPhase };
  }

  const sunsetInMinutes = Math.round((sunset.getTime() - now.getTime()) / 60000);

  // SunCalc azimuth: radians, measured from SOUTH, increasing westward.
  const az = getPosition(sunset, lat, lng).azimuth;
  const sunsetBearing = (az * 180 / Math.PI + 180) % 360; // compass degrees, 0 = north

  return { sunsetInMinutes, sunsetBearing, moonPhase };
}