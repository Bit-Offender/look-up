"use client";

import { useEffect, useState } from "react";

import { useGetContext } from "@/hooks/useGetContext";

import ContextChips from "@/components/ContextChips";
import MissionCard from "@/components/MissionCard";

import { pickMission } from "@/lib/pickMission";
import type { Mission } from "@/lib/missions";

export default function Home() {
  const { context, status, error } = useGetContext();

  const [mission, setMission] = useState<Mission | null>(null);

  useEffect(() => {
    if (!context) return;

    pickMission(context).then(setMission);
  }, [context]);

  if (status === "loading") {
    return <p>Reading the sky…</p>;
  }

  if (status === "error" || !context) {
    return <p>{error ?? "Something went wrong"}</p>;
  }

  if (!mission) {
    return <p>Finding a mission…</p>;
  }

  return (
    <main className="p-6">
      <ContextChips context={context} />

      <MissionCard mission={mission} />
    </main>
  );
}

