"use client";

import { useCallback, useEffect, useState } from "react";

import { useGetContext } from "@/hooks/useGetContext";

import ContextChips from "@/components/ContextChips";
import MissionCard from "@/components/MissionCard";

import { fill } from "@/lib/fill";
import type { Mission } from "@/lib/missions";
import { pickMission } from "@/lib/pickMission";
import { loadRecent, pushRecent } from "@/lib/recent";
import { buildFacts, getMoon } from "@/lib/sky";
import { getPhaseAt } from "@/lib/sun";
import { getWeather } from "@/lib/weather";

type Picked = { mission: Mission; text: string };

export default function Home() {
  const { context, status, error } = useGetContext();
  const [picked, setPicked] = useState<Picked | null>(null);

  const compute = useCallback(async (): Promise<Picked | null> => {
    if (!context) return null;
    const { latitude: lat, longitude: lng } = context;
    const now = new Date();

    const phase = getPhaseAt(now, lat, lng);
    const sky = await getWeather(lat, lng)
      .then((w) => w.sky)
      .catch(() => null);

    const mission = pickMission({
      phase,
      sky,
      moonUp: getMoon(now, lat, lng).up,
      recentIds: loadRecent(),
    });

    return {
      mission,
      text: fill(mission.instruction, buildFacts(lat, lng, now)),
    };
  }, [context]);

  const commit = useCallback((p: Picked) => {
    pushRecent(p.mission.id);
    setPicked(p);
  }, []);

  useEffect(() => {
    let live = true;
    compute().then((p) => {
      if (live && p) commit(p);
    });
    return () => {
      live = false;
    };
  }, [compute, commit]);

  if (status === "loading") return <p>Reading the sky…</p>;
  if (status === "error" || !context) return <p>{error ?? "Something went wrong"}</p>;
  if (!picked) return <p>Finding a mission…</p>;

  return (
    <main className="p-6">
      <ContextChips context={context} />
      <MissionCard mission={{ ...picked.mission, instruction: picked.text }} />
      <button
        onClick={() => compute().then((p) => p && commit(p))}
        className="mt-4 text-sm underline opacity-70"
      >
        Another mission
      </button>
    </main>
  );
}