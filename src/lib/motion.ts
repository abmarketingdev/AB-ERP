/**
 * Motion tokens from doc 02.
 *
 * "Motion here has one job: explain what changed. It never decorates and it
 * never delays." Every duration and curve in the product comes from here, so
 * the whole app moves at one rhythm rather than each screen inventing its own —
 * which is most of what separates an interface that feels considered from one
 * that feels assembled.
 */
export const DUR = {
  /** Hover, focus, tap feedback, tooltip. */
  fast: 0.12,
  /** Panel open, card expand, tab change. */
  base: 0.2,
  /** Route transition, drawer, chart mount. */
  slow: 0.32,
} as const;

/** Entrances decelerate into place. */
export const EASE_ENTER = [0.2, 0, 0, 1] as const;
/** Exits accelerate away — shorter than the entrance, so dismissal feels responsive. */
export const EASE_EXIT = [0.4, 0, 1, 1] as const;

/**
 * The one overshoot curve, reserved for confirmations. Using it anywhere else
 * is how a product starts feeling bouncy instead of quick.
 */
export const SPRING_CONFIRM = { type: "spring", stiffness: 500, damping: 32 } as const;

export const enter = { duration: DUR.base, ease: EASE_ENTER };
export const exit = { duration: DUR.fast, ease: EASE_EXIT };

/**
 * 30ms per item, capped at six. Doc 02: "Never stagger a long list" — past a
 * handful of rows a stagger stops reading as sequence and starts reading as lag.
 */
export function stagger(index: number, step = 0.03, max = 6): number {
  return Math.min(index, max - 1) * step;
}

/** Standard mount for a card or row. Pass `reduced` from `useReducedMotion`. */
export function riseIn(index: number, reduced: boolean | null) {
  return {
    initial: reduced ? false : ({ opacity: 0, y: 8 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { ...enter, delay: reduced ? 0 : stagger(index) },
  };
}

/** Standard expand/collapse for a disclosure panel. */
export function expand(reduced: boolean | null) {
  return {
    initial: reduced ? false : ({ opacity: 0, height: 0 } as const),
    animate: { opacity: 1, height: "auto" as const },
    exit: { opacity: 0, height: 0 },
    transition: enter,
  };
}
