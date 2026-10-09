import Link from "next/link";
import type { Mission } from "@/lib/missions/missions";

type MissionCardProps = {
  mission: Mission;
  onAnother?: () => void;
};

export default function MissionCard({ mission, onAnother }: MissionCardProps) {
  return (
    <article className="mission px-box">
      <div className="mission__meta">
        <span>{mission.min} min</span>
        <span>{mission.time.join(" · ")}</span>
      </div>

      <h2 className="mission__title">{mission.title}</h2>
      <p className="mission__text">{mission.instruction}</p>

      <div className="mission__actions">
        <Link href="/away" className="px-btn">Go outside</Link>
        {onAnother && (
          <button onClick={onAnother} className="px-btn px-btn--ghost">Another</button>
        )}
      </div>
    </article>
  );
}