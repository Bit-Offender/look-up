"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppContext } from "@/types/context";
import { getSunInfo } from "@/lib/world/sun";
import { getWeather } from "@/lib/world/weather";

type Status = "loading" | "ready" | "error";

export function useGetContext() {
  const supported = useSyncExternalStore(
    () => () => {}, // nothing to subscribe to
    () => "geolocation" in navigator, // client value
    () => true, // server value (avoids hydration mismatch)
  );

  const [context, setContext] = useState<AppContext | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        try {
          const sun = getSunInfo(latitude, longitude);
          const weather = await getWeather(latitude, longitude).catch(() => ({
            rainLast6h: 0,
            cloudCover: 0,
            sky: null,
          }));
          if (cancelled) return;
          setContext({ latitude, longitude, ...sun, ...weather });
          setStatus("ready");
        } catch {
          if (cancelled) return;
          setStatus("error");
          setError("Couldn't load weather");
        }
      },
      (err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.message);
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
  }, [supported]);

  if (!supported) {
    return {
      context: null,
      status: "error" as Status,
      error: "Geolocation is not supported",
    };
  }

  return { context, status, error };
}
