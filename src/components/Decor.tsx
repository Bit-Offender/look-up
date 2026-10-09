import PixelSprite from "@/components/PixelSprite";
import {
  BUTTERFLY, CLOUD, DECOR_PALETTE, FLOWER_A, FLOWER_B, HILL, MUSHROOM, TREE,
} from "@/lib/marrow/sprites";

/* Layout is just data: where each thing stands. Add a line to add decor. */
const FLOWERS = [
  { left: "21%", bottom: 30, rows: FLOWER_A },
  { left: "29%", bottom: 36, rows: FLOWER_B },
  { left: "57%", bottom: 32, rows: FLOWER_A },
  { left: "64%", bottom: 38, rows: FLOWER_B },
  { left: "91%", bottom: 33, rows: FLOWER_A },
];

const CLOUDS = [
  { top: 14, scale: 5, dur: "95s", delay: "-30s" },
  { top: 44, scale: 3, dur: "130s", delay: "-90s" },
  { top: 26, scale: 4, dur: "110s", delay: "-5s" },
];

const FIREFLIES = [
  { left: "18%", top: 110, delay: "0s" }, { left: "38%", top: 90, delay: "-1.1s" },
  { left: "52%", top: 130, delay: "-0.5s" }, { left: "71%", top: 100, delay: "-1.7s" },
  { left: "86%", top: 125, delay: "-0.9s" },
];

/** Everything pretty that Marrow walks past. Purely decorative: no state, no effects. */
export default function Decor() {
  return (
    <>
      {/* Far layer: sits behind the ground. Colors come from CSS vars so dusk/night can recolor. */}
      <div className="layer layer--far">
        <PixelSprite rows={HILL} palette={DECOR_PALETTE} scale={14} style={{ left: "-8%", bottom: 44 }} />
        <PixelSprite rows={HILL} palette={DECOR_PALETTE} scale={11} style={{ left: "46%", bottom: 44 }} />
        {CLOUDS.map((c, i) => (
          <PixelSprite
            key={i}
            rows={CLOUD}
            palette={DECOR_PALETTE}
            scale={c.scale}
            className="cloud"
            style={{ top: c.top, animationDuration: c.dur, animationDelay: c.delay }}
          />
        ))}
      </div>

      {/* Near layer: stands on the grass, in front of the ground, behind Marrow. */}
      <div className="layer layer--near">
        <PixelSprite rows={TREE} palette={DECOR_PALETTE} scale={6} style={{ left: "5%", bottom: 38 }} />
        <PixelSprite rows={TREE} palette={DECOR_PALETTE} scale={5} style={{ left: "80%", bottom: 40 }} />
        <PixelSprite rows={MUSHROOM} palette={DECOR_PALETTE} scale={3} style={{ left: "45%", bottom: 32 }} />
        <PixelSprite rows={MUSHROOM} palette={DECOR_PALETTE} scale={2} style={{ left: "13%", bottom: 28 }} />
        {FLOWERS.map((f, i) => (
          <PixelSprite key={i} rows={f.rows} palette={DECOR_PALETTE} scale={3} style={{ left: f.left, bottom: f.bottom }} />
        ))}
        <PixelSprite rows={BUTTERFLY} palette={DECOR_PALETTE} scale={3} className="butterfly" />
        {FIREFLIES.map((f, i) => (
          <span key={i} className="firefly" style={{ left: f.left, top: f.top, animationDelay: f.delay }} />
        ))}
      </div>
    </>
  );
}