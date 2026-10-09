import type { AppContext } from "@/types/context";

export default function ContextChips({ context }: { context: AppContext }) {

  const chips = [
    { label: "Sky", value: context.phase },
    context.sunsetInMinutes !== null && {
      label: "Sunset",
      value:
        context.sunsetInMinutes >= 0
          ? `in ${context.sunsetInMinutes} min`
          : `${Math.abs(context.sunsetInMinutes)} min ago`,
    },
    { label: "Clouds", value: `${context.cloudCover}%` },
    { label: "Rain 6h", value: `${context.rainLast6h.toFixed(1)} mm` },
    { label: "Moon", value: `${Math.round(context.moonPhase * 100)}%` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <ul className="chips">
      {chips.map((c) => (
        <li key={c.label} className="chip">
          <span>{c.label} </span>
          {c.value}
        </li>
      ))}
    </ul>
  );
}