import type { Mission } from "@/lib/missions";

type MissionCardProps = {
  mission: Mission;
};

export default function MissionCard({
  mission,
}: MissionCardProps) {
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-black/50">
          {mission.min} min
        </span>

        <span className="rounded-full bg-black/5 px-3 py-1 text-xs capitalize text-black/60">
          {mission.time.join(" · ")}
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">
        {mission.title}
      </h2>

      <p className="mt-3 leading-relaxed text-black/70">
        {mission.instruction}
      </p>
    </article>
  );
}

