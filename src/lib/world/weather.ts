import { getDB } from "../db/db";

export type SkyCondition = "clear" | "cloudy" | "rain";

export type Forecast = {
  fetchedAt: number;
  times: number[]; // epoch ms, hourly
  cloudCover: number[];
  precipitation: number[];
  precipProbability: (number | null)[];
};

const TTL_MS = 60 * 60 * 1000;
const inflight = new Map<string, Promise<Forecast>>();

const cacheKey = (lat: number, lng: number) =>
  `${lat.toFixed(2)},${lng.toFixed(2)}`;

export function classifySky(
  cloud: number,
  precip: number,
  prob: number,
  useProbability: boolean
): SkyCondition {
  if (precip >= 0.1 || (useProbability && prob >= 60)) return "rain";
  if (cloud >= 60) return "cloudy";
  return "clear";
}

async function fetchForecast(lat: number, lng: number): Promise<Forecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "cloud_cover,precipitation,precipitation_probability",
    timeformat: "unixtime",
    timezone: "auto",
    past_hours: "6",
    forecast_days: "3",
  }).toString();

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const { hourly } = await res.json();

  return {
    fetchedAt: Date.now(),
    times: (hourly.time as number[]).map((s) => s * 1000),
    cloudCover: hourly.cloud_cover,
    precipitation: hourly.precipitation,
    precipProbability: hourly.precipitation_probability,
  };
}

async function readCache(key: string) {
  try {
    return await (await getDB()).get("forecastCache", key);
  } catch {
    return undefined; // private mode etc.
  }
}

async function writeCache(key: string, forecast: Forecast) {
  try {
    await (await getDB()).put("forecastCache", {
      key,
      fetchedAt: forecast.fetchedAt,
      forecast,
    });
  } catch {
    /* cache is best-effort */
  }
}

export function getForecast(lat: number, lng: number): Promise<Forecast> {
  const key = cacheKey(lat, lng);
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const cached = await readCache(key);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      return cached.forecast;
    }
    try {
      const fresh = await fetchForecast(lat, lng);
      await writeCache(key, fresh);
      return fresh;
    } catch (err) {
      if (cached) return cached.forecast; // stale beats nothing offline
      throw err;
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/** Sky at a given time, or null if the forecast doesn't cover it. */
export function skyAt(forecast: Forecast, at: number) {
  let best = Infinity;
  let idx = -1;
  forecast.times.forEach((t, i) => {
    const d = Math.abs(t - at);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  if (idx < 0 || best > 2 * 60 * 60 * 1000) return null;

  const useProbability = at - Date.now() > 30 * 60 * 1000;
  const cloudCover = forecast.cloudCover[idx] ?? 0;
  const precipitation = forecast.precipitation[idx] ?? 0;
  const prob = forecast.precipProbability[idx] ?? 0;

  return {
    sky: classifySky(cloudCover, precipitation, prob, useProbability),
    cloudCover,
    precipitation,
  };
}

/** Same shape as before, so ContextChips keeps working. */
export async function getWeather(lat: number, lng: number) {
  const f = await getForecast(lat, lng);
  const now = Date.now();
  const cur = skyAt(f, now);

  const rainLast6h = f.times.reduce(
    (sum, t, i) =>
      t <= now && t > now - 6 * 3_600_000 ? sum + (f.precipitation[i] ?? 0) : sum,
    0
  );

  return {
    rainLast6h,
    cloudCover: cur?.cloudCover ?? 0,
    sky: (cur?.sky ?? null) as SkyCondition | null,
  };
}