import { matchByDataKey } from "recharts";

/**
 * Shared animation settings for every Recharts wrapper.
 *
 * Three things here are not obvious and cost real time to discover:
 *
 * **`isAnimationActive` is deliberately absent.** Its default is `'auto'`,
 * which already means "off during SSR and off under prefers-reduced-motion" —
 * Recharts subscribes to the media query itself. Passing `false` disables the
 * data-change morph entirely; passing `true` opts that element *out* of the
 * reduced-motion preference. The default is better than either.
 *
 * **Recharts' easing names do not mean what CSS means.** In its own easing
 * table `'ease-out'` maps to `[0.42, 0, 0.58, 1]` — that is CSS `ease-in-out` —
 * and `'ease-in-out'` maps to CSS `ease-out`. A `cubic-bezier()` string parses
 * correctly, so the design token goes in literally and the confusion disappears.
 * (A typo'd easing name returns null and silently disables animation.)
 *
 * **The default duration is 1500ms** for lines and areas, roughly five times
 * doc 02's `slow` token.
 */
export const CHART_MOTION = {
  animationDuration: 320,
  animationEasing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/**
 * Match points across a data change by their label rather than by array index.
 *
 * Without it, filtering a series makes the point that *was* at index 4 morph
 * into whatever now sits at index 4 — so the motion asserts a change that never
 * happened. Object constancy is the entire reason to animate a data change.
 */
export const MATCH_BY_LABEL = matchByDataKey("label");
