import * as React from "react";

type Position = 1 | -1;

type Point = readonly [number, number];

type LayerSpec = {
  /** Two cubic segments: start, c1, c2, mid, c3, c4, end — in viewBox units. */
  points: readonly Point[];
  /** Constant offset between one line and the next. */
  delta: Point;
  count: number;
  /** How many lines sit "before" the first visible one. */
  lead: number;
  /** Seconds to travel exactly one `delta`. */
  duration: number;
  width: number;
  opacity: number;
};

const VIEW_W = 1000;
const VIEW_H = 1200;

/**
 * Every line in a layer is the same curve shifted by `i * delta`, and the layer
 * animates by exactly one `delta` per cycle. That makes line `i` land precisely
 * where line `i + 1` used to be, so the end of a cycle is pixel-identical to its
 * start and the loop loops seamlessly at a constant `linear` speed.
 *
 * Two consequences worth knowing before editing these numbers:
 *  - `count`/`lead` must keep the first and last line fully outside the frame,
 *    since those two are the ones gained and lost on each wrap.
 *  - Stroke width and opacity must be uniform within a layer. Varying them per
 *    line would make the wrap visible, because a line would not match the
 *    neighbour whose place it takes.
 */
const LAYERS: Record<"a" | "b", LayerSpec> = {
  a: {
    // y spans 200..1250, so `lead` 70 lifts line 0 clear of the top
    // (1250 - 18*70 < 0) and `count` 127 pushes the last line past the bottom.
    points: [
      [-280, 200],
      [150, 260],
      [430, 400],
      [620, 640],
      [760, 820],
      [850, 980],
      [980, 1250],
    ],
    delta: [-14, 18],
    count: 127,
    lead: 70,
    duration: 1.8,
    width: 0.9,
    opacity: 0.85,
  },
  b: {
    // y spans 300..1120; same reasoning with a wider spacing and a slower cycle,
    // which reads as parallax against layer a.
    points: [
      [-300, 300],
      [100, 330],
      [420, 420],
      [660, 620],
      [830, 760],
      [930, 880],
      [1150, 1120],
    ],
    delta: [-11, 30],
    count: 70,
    lead: 38,
    duration: 3.6,
    width: 0.8,
    opacity: 0.4,
  },
};

function buildLayer(spec: LayerSpec): string[] {
  const [dx, dy] = spec.delta;
  return Array.from({ length: spec.count }, (_, i) => {
    const ox = dx * (i - spec.lead);
    const oy = dy * (i - spec.lead);
    const [s, c1, c2, mid, c3, c4, end] = spec.points.map(([x, y]) => [x + ox, y + oy]);
    return `M${s[0]} ${s[1]}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${mid[0]} ${mid[1]}C${c3[0]} ${c3[1]} ${c4[0]} ${c4[1]} ${end[0]} ${end[1]}`;
  });
}

// Resolved once at module load, and fully deterministic — nothing here may use
// Math.random(), or the server and client markup would disagree on hydration.
const PATHS = { a: buildLayer(LAYERS.a), b: buildLayer(LAYERS.b) } as const;

/**
 * Decorative line field.
 *
 * The paths are static and rasterised once; only `transform` moves, which the
 * compositor handles without ever repainting. That distinction is load-bearing —
 * animating a stroke property instead (stroke-dashoffset, per-path opacity) forces
 * a full re-raster of the SVG every frame and measured ~83ms/frame, no matter how
 * few paths were drawn, and the original JS-driven version cost ~133ms/frame.
 *
 * Being pure CSS, it also runs entirely off the main thread and cannot be stalled
 * or restarted by a re-render of whatever component hosts it.
 */
export const FloatingPaths = React.memo(function FloatingPaths({ position }: { position: Position }) {
  const key = position === 1 ? "a" : "b";
  const spec = LAYERS[key];
  const [dx, dy] = spec.delta;

  return (
    // Static wrapper: holds the clip and the fade, so neither travels with the lines.
    <div aria-hidden className="ab-paths-mask pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="ab-paths-layer absolute -inset-[8%]"
        style={
          {
            // Derived from the geometry above so the travel distance can never
            // drift out of step with the line spacing.
            "--ab-dx": `${(dx / VIEW_W) * 100}%`,
            "--ab-dy": `${(dy / VIEW_H) * 100}%`,
            animationDuration: `${spec.duration}s`,
          } as React.CSSProperties
        }
      >
        <svg
          className="h-full w-full text-foreground"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          fill="none"
          preserveAspectRatio="none"
        >
          <title>Background paths</title>
          {PATHS[key].map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="currentColor"
              strokeWidth={spec.width}
              strokeOpacity={spec.opacity}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="ab-paths-fade absolute inset-0" />
    </div>
  );
});
