import type { AppContext } from "@/types/context";
import { getPhase } from "@/lib/sun";

export default function ContextChips({ context }: { context: AppContext }) {
  const phase = getPhase(context.sunsetInMinutes);

  const chips = [
    { label: "Phase", value: phase },
    context.sunsetInMinutes !== null && {
      label: "Sunset",
      value:
        context.sunsetInMinutes >= 0
          ? `in ${context.sunsetInMinutes} min`
          : `${Math.abs(context.sunsetInMinutes)} min ago`,
    },
    { label: "Clouds", value: `${context.cloudCover}%` },
    { label: "Rain (6h)", value: `${context.rainLast6h.toFixed(1)} mm` },
    { label: "Moon", value: `${Math.round(context.moonPhase * 100)}% through cycle` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.label} className="rounded-full border px-3 py-1 text-sm">
          <span className="opacity-60">{c.label}: </span>
          {c.value}
        </li>
      ))}
    </ul>
  );
}