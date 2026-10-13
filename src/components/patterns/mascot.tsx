"use client";

import * as React from "react";
import { motion as m, useReducedMotion, useInView } from "motion/react";

/**
 * Pandi — the AB Marketing mascot.
 *
 * ## He is a state readout, not a pet
 *
 * The artwork is a library of 27 poses and 27 four-second loops, and the
 * temptation is to autoplay all of them forever. That is the one thing this
 * component will not do, for three reasons that outlive any particular artwork:
 *
 *  - **WCAG 2.2.2** governs motion that starts *by itself* and runs longer than
 *    five seconds. A loop that plays once on a state change and then holds is
 *    out of scope entirely; an infinite idle is not.
 *  - **Shneiderman's "cute, silly, then annoying"** is an objection to
 *    *decorative* anthropomorphism. A character that only moves when something
 *    happened is a status indicator with a face.
 *  - This is a system people sit in front of for eight hours a day, and it will
 *    be read by a works council. A mascot that idles at you is an engagement
 *    mechanic; one that acknowledges an event is not.
 *
 * So motion is spent in exactly two ways: `loop` while a genuine wait is in
 * progress, and `once` on a state change. Everything else is a still. See
 * `DEFAULT_MOTION` — that table is the policy, and it is the thing to argue
 * with, not the individual call sites.
 *
 * ## The light plate is not decoration
 *
 * The loops have no alpha channel; transparency is faked at runtime by keying
 * near-white out of a baked-in white plate (see `mascot-filters.tsx`). VP9 is a
 * lossy codec, so the pixels immediately around the figure are *nearly* white
 * rather than white, and on a dark ground they survive the key as visible
 * macroblock halos. On a light ground they are invisible.
 *
 * The staff app is dark throughout (`shell.tsx`), so this component always
 * renders its own light plate underneath rather than trusting each caller to
 * remember. `PLATE` is the artwork's own paper colour.
 *
 * ## Size decides everything
 *
 * These are illustrations, not icons. Below roughly 48px the full figure is an
 * unreadable smudge — the nav slots this replaced were 22px and 28px. So small
 * sizes get a **head crop** on a circular plate, which reads as a face down to
 * 24px. The crop window below was measured against the artwork, not guessed.
 */

/** The artwork's own paper colour. Works on every surface in the product. */
const PLATE = "#F4F1EA";

/** Below this, the full figure stops being legible and we crop to the head. */
const HEAD_CROP_BELOW = 48;

/**
 * Head-crop window in the stills' 1024-unit space. Tuned by eye against 24, 28,
 * 32 and 40px renders: tighter than this and the ears are clipped hard enough
 * to lose the silhouette, wider and the face is too small to read at 24px.
 *
 * This window is only meaningful for the poses in `PORTRAIT` below — it is
 * measured against a figure standing centred and filling the frame.
 */
const CROP = { x: 320, y: 170, w: 390 } as const;

/**
 * Poses framed as a portrait: the figure centred, roughly filling the frame.
 * Only these can be head-cropped — the rest are *scenes*, a small figure
 * somewhere inside a wide illustration, and the crop window over one of those
 * returns a rectangle of sandcastle or pond rather than a face.
 *
 * A scene pose asked for below the crop threshold therefore falls back to
 * `standing`'s head. That loses the scenario, but the scenario was already lost
 * — at 24px a wide illustration is a smudge — and a legible face is worth more
 * than an unreadable scene. The requested pose is still reported on
 * `data-pose`, so the state remains inspectable even where it is not drawable.
 */
const PORTRAIT = new Set<MascotPose>([
  "standing",
  "clipboard",
  "delivery",
  "guitar",
  "commuting",
]);
// Checked by rendering the crop window over every candidate at 24/32/40px.
// `teamwork` puts two figures either side of the window and crops to a pair of
// hands; `meeting-chaos` has calendars at head height, so the crop returns the
// number 2; `skateboard` draws the figure small and off-centre. All three fall
// back to `standing` when small.

export type MascotPose =
  | "barbecue" | "building" | "campfire" | "clipboard" | "cloudwatching"
  | "commuting" | "delivery" | "designer" | "flying-a-kite" | "gaming"
  | "guitar" | "hammock" | "light-work" | "lounging" | "manager"
  | "meeting-chaos" | "painting" | "picnic" | "prototyping" | "reading"
  | "research-development" | "skateboard" | "standing" | "teamwork"
  | "video-call" | "whiteboard" | "yoga";

/**
 * The semantic states, carried over unchanged from the mascot this replaced so
 * that every existing call site keeps working. A caller says what happened;
 * this component decides which of the 27 poses says it.
 */
export type MascotState =
  | "idle"
  | "greeting"
  | "ready"
  | "win-small"
  | "win-big"
  | "concerned"
  | "sleeping"
  | "thinking";

export type MascotMotion = "auto" | "loop" | "once" | "still";

/**
 * State → pose. The pack ships its own captions for these ("ingen data / tom
 * tilstand", "mål nådd", "feil, travel uke"), and they line up with this app's
 * five-state data contract closely enough that most of this table is the
 * artwork's own intent rather than ours.
 */
const STATE_POSE: Record<MascotState, MascotPose> = {
  idle: "standing",
  greeting: "standing",
  ready: "standing",
  thinking: "standing", // "standard, laster, hilsen" — the loading pose
  sleeping: "cloudwatching", // "ingen data / tom tilstand"
  concerned: "meeting-chaos", // "feil, travel uke"
  "win-small": "clipboard", // "kvalitetssjekk" — carries an APPROVED stamp
  "win-big": "flying-a-kite", // "mål nådd"
};

/**
 * The motion policy, in one table.
 *
 * `loop` is reserved for states that mean "you are waiting on us". `once`
 * marks a thing that just happened. Everything else holds still, because a
 * pose that is merely *describing* a screen has nothing to announce.
 */
const DEFAULT_MOTION: Record<MascotState, MascotMotion> = {
  idle: "still",
  ready: "still",
  sleeping: "still",
  concerned: "still",
  greeting: "once",
  "win-small": "once",
  "win-big": "once",
  thinking: "loop",
};

/**
 * Poses with a loop shipped in `public/mascot/loop`. The other 21 exist as
 * stills only — 4.2MB of video for poses that never move is not a trade worth
 * making, and asking for one is a deliberate act. A `loop`/`once` request for a
 * pose outside this set degrades to a still rather than 404ing a <video>.
 */
const HAS_LOOP = new Set<MascotPose>([
  "standing",
  "flying-a-kite",
  "clipboard",
  "guitar",
  "teamwork",
  "campfire",
]);

export interface MascotProps {
  /** What happened. Picks the pose and the motion unless overridden. */
  state?: MascotState;
  /** Name a pose directly, for the many that no semantic state covers. */
  pose?: MascotPose;
  size?: number;
  /** Overrides the state-derived motion. `auto` follows `DEFAULT_MOTION`. */
  motion?: MascotMotion;
  className?: string;
  /** Reacts to hover/tap. For nav and chrome placements. */
  interactive?: boolean;
  /**
   * Announces a wait to screen readers. Supply this wherever the mascot *is*
   * the loading indicator — a spinner nobody can hear is a spinner that only
   * works for people who can see it.
   */
  label?: string;
}

export function Mascot({
  state = "idle",
  pose: poseProp,
  size = 64,
  motion: motionProp = "auto",
  className,
  interactive = false,
  label,
}: MascotProps) {
  const reducedRaw = useReducedMotion();
  // `useReducedMotion` is null until the media query resolves. Treating null as
  // "reduced" costs a still frame on first paint and avoids flashing motion at
  // someone who asked for none.
  const reduced = reducedRaw !== false;

  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.3 });

  const pose = poseProp ?? STATE_POSE[state];
  const small = size < HEAD_CROP_BELOW;
  const cropped = small;
  // What to actually draw when cropping — see PORTRAIT.
  const cropPose: MascotPose = PORTRAIT.has(pose) ? pose : "standing";

  const requested = motionProp === "auto" ? DEFAULT_MOTION[state] : motionProp;
  /*
   * Reasons to hold still, collapsed into one decision. Small sizes default to
   * still because a few pixels of movement is shimmer rather than motion — but
   * an *explicit* `motion` from the caller is honoured, because the one place
   * that asks for it is a button-sized wait indicator, where the movement is
   * the entire point.
   */
  const motion: MascotMotion =
    !HAS_LOOP.has(pose) || reduced || !inView || (small && motionProp === "auto")
      ? "still"
      : requested;

  const wrap: React.CSSProperties = {
    width: size,
    height: size,
    display: "inline-block",
    position: "relative",
    overflow: "hidden",
    background: PLATE,
    // A circle reads as an avatar at chrome sizes; a card is right for the
    // full figure, and matches the radius scale the rest of the product uses.
    borderRadius: cropped ? "50%" : "var(--radius-md)",
    cursor: interactive ? "pointer" : undefined,
    flexShrink: 0,
  };

  return (
    <m.span
      ref={ref}
      data-mascot
      data-pose={pose}
      data-state={state}
      data-motion={motion}
      data-cropped={String(cropped)}
      className={className}
      style={wrap}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-label={label}
      whileHover={interactive ? { scale: 1.08 } : undefined}
      whileTap={interactive ? { scale: 0.94 } : undefined}
      transition={{ duration: 0.12, ease: [0.2, 0, 0.38, 0.9] }}
    >
      {motion === "still" ? (
        <MascotStill pose={cropped ? cropPose : pose} size={size} cropped={cropped} priority={Boolean(label)} />
      ) : (
        <video
          key={`${pose}-${motion}`}
          src={`/mascot/loop/${cropped ? cropPose : pose}.webm`}
          autoPlay
          loop={motion === "loop"}
          muted
          playsInline
          // The still is the poster, so a slow decode shows the character
          // rather than an empty plate.
          poster={`/mascot/still/${cropped ? cropPose : pose}.svg`}
          aria-hidden="true"
          style={{
            filter: "url(#pandiArktis)",
            display: "block",
            ...(cropped ? cropStyle(size) : { width: "100%", height: "100%", objectFit: "contain" }),
          }}
        />
      )}
    </m.span>
  );
}

/** Position/size that puts the crop window over the element's box. */
function cropStyle(size: number): React.CSSProperties {
  return {
    position: "absolute",
    width: (size / CROP.w) * 1024,
    height: (size / CROP.w) * 1024,
    maxWidth: "none",
    left: -(CROP.x * size) / CROP.w,
    top: -(CROP.y * size) / CROP.w,
  };
}

/**
 * The still. Two layouts: the whole figure contained in the plate, or the head
 * crop, which is the same artwork scaled up and offset so the face fills a
 * circle. Doing the crop with position/size rather than a second set of assets
 * means the two tiers can never drift apart.
 */
function MascotStill({
  pose,
  size,
  cropped,
  priority,
}: {
  pose: MascotPose;
  size: number;
  cropped: boolean;
  priority: boolean;
}) {
  const src = `/mascot/still/${pose}.svg`;

  if (!cropped) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={cropStyle(size)}
    />
  );
}

export default Mascot;
