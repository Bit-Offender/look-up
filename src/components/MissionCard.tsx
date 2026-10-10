"use client";

import Link from "next/link";
import { saveActiveMission } from "@/lib/missions/activeMissions";
import { fill } from "@/lib/missions/fill";
import type { Mission } from "@/lib/missions/missions";

type MissionCardProps = {
  mission: Mission;
  /** Values for {placeholders}, e.g. { sunset_time: "6:12 PM", moon_status: "waxing crescent" }.
   *  Leave out if the instruction was already filled before it reached the card. */
  facts?: Record<string, string>;
  onAnother?: () => void;
};

function readable(mission: Mission, facts?: Record<string, string>): string {
  if (!facts) return mission.instruction;
  try {
    return fill(mission.instruction, facts);
  } catch {
    return mission.instruction; // a placeholder had no value; fill() throws on unknown keys
  }
}

export default function MissionCard({ mission, facts, onAnother }: MissionCardProps) {
  const text = readable(mission, facts);

  // Leave the mission where /away and /journal/new can read it. Runs before the navigation.
  const rememberMission = () =>
    saveActiveMission({ id: mission.id, title: mission.title, text, minutes: mission.min });

  return (
    <article className="mission px-box">
      <div className="mission__meta">
        <span>{mission.min} min</span>
        <span>{mission.time.join(" · ")}</span>
      </div>

      <h2 className="mission__title">{mission.title}</h2>
      <p className="mission__text">{text}</p>

      <div className="mission__actions">
        <Link href="/away" className="px-btn" onClick={rememberMission}>
          Go outside
        </Link>
        {onAnother && (
          <button onClick={onAnother} className="px-btn px-btn--ghost">Another</button>
        )}
      </div>
    </article>
  );
}