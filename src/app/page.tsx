"use client";

import { useCallback, useEffect, useState } from "react";

import { useGetContext } from "@/hooks/useGetContext";

import ContextChips from "@/components/ContextChips";
import Marrow from "@/components/Marrow";
import MissionCard from "@/components/MissionCard";

import { fill } from "@/lib/missions/fill";
import type { Mission } from "@/lib/missions/missions";
import { pickMission } from "@/lib/missions/pickMission";
import { loadRecent, pushRecent } from "@/lib/missions/recent";
import { buildFacts, getMoon } from "@/lib/world/sky";
import { getPhaseAt, sceneTint, type Phase } from "@/lib/world/sun";
import { getWeather } from "@/lib/world/weather";

type Picked = { mission: Mission; text: string; phase: Phase; sky: string };

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
      phase,
      sky: sky ?? "unknown",
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

  if (status === "loading")
    return <main className="shell"><p className="font-pixel" style={{ fontSize: 12 }}>Reading the sky…</p></main>;
  if (status === "error" || !context)
    return <main className="shell"><p>{error ?? "Couldn't read your location. Allow location access and reload."}</p></main>;
  if (!picked)
    return <main className="shell"><p className="font-pixel" style={{ fontSize: 12 }}>Finding a mission…</p></main>;

  return (
    <main className="shell">
      {/* phase strings must be "day" | "dusk" | "night" for the scene tint; see mapPhase below */}
      <Marrow phase={sceneTint(picked.phase)} sky={picked.sky} />
      <ContextChips context={context} />
      <MissionCard
        mission={{ ...picked.mission, instruction: picked.text }}
        onAnother={() => compute().then((p) => p && commit(p))}
      />
    </main>
  );
}
