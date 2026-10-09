import { memo, type CSSProperties, type ReactElement } from "react";

export type Palette = Record<string, string>;

/**
 * Turns rows of characters into SVG <rect>s.
 * Optimization: runs of the same character on one row merge into ONE wide rect,
 * so "hhhhhhhh" is 1 element instead of 8 (run-length encoding).
 * memo() skips re-rendering when props are unchanged, and Marrow re-renders a lot.
 */
export const PixelRects = memo(function PixelRects({
  rows,
  palette,
  y0 = 0,
}: {
  rows: string[];
  palette: Palette;
  y0?: number; // vertical offset, used to place the legs under the body
}) {
  const rects: ReactElement[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (row[x + run] === ch) run++;

      const fill = palette[ch];
      // "." (or any char not in the palette) is transparent: draw nothing.
      // style={{ fill }} instead of the fill attribute so var(--x) values work.
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y + y0} width={run} height={1} style={{ fill }} />);
      x += run;
    }
  });

  return <g>{rects}</g>;
});

/** A standalone sprite: an <svg> whose viewBox is in "art pixels", scaled up by `scale`. */
export default function PixelSprite({
  rows,
  palette,
  scale = 4,
  className,
  style,
}: {
  rows: string[];
  palette: Palette;
  scale?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const w = rows[0].length;
  const h = rows.length;
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges" // no anti-aliasing: hard pixel edges
      className={className}
      style={style}
      aria-hidden
    >
      <PixelRects rows={rows} palette={palette} />
    </svg>
  );
}