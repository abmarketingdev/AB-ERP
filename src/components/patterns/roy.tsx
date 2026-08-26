"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useFollowValue,
  useReducedMotion,
  useInView,
  animate,
  type MotionValue,
} from "motion/react";

/**
 * Røy — the AB Marketing arctic fox.
 *
 * ## The governing idea: he is a state readout, not a pet
 *
 * Røy has no autonomous motion worth the name. He moves because something
 * happened — a route changed, a request resolved, a target was reached — and
 * then he goes still. That single decision resolves three constraints at once:
 *
 *  - **WCAG 2.2.2** governs motion that starts *by itself*. Motion caused by a
 *    user action is out of scope entirely. Bounding a decorative loop to 4.4s
 *    passes the letter of the rule while still spending attention on nothing.
 *  - **Shneiderman's "cute, silly, then annoying"** is an objection to
 *    *decorative* anthropomorphism. A character that only reacts to state is a
 *    status indicator with a face.
 *  - A works council reading this as an engagement mechanic is a real risk. A
 *    mascot that idles at you is one; a mascot that acknowledges an event is not.
 *
 * The spontaneous-motion budget below therefore **de-escalates**: each beat is
 * smaller than the last until it drops under the perceptual floor and stops.
 * Escalation ("he gets restless if you ignore him") is the nagging pattern, and
 * it is deliberately impossible here.
 *
 * ## The rig
 *
 * Previously one `<g>` carried one transform, so every part of Røy moved in
 * perfect lockstep — the single strongest "sticker, not a creature" tell there
 * is. Now one driver value (`bodyY`) is followed by head, ears and tail through
 * springs with increasing settle time, and their **rotation is derived from the
 * lag**, not hand-authored. The lag *is* the follow-through, and it scales
 * automatically: a small bob makes a small tail swish, a big hop makes a big one.
 *
 * Settle-time gradient — mouth 0.19s → head 0.31s → ears 0.40s → tail 0.74s.
 * Overshoot runs the other way: light parts overshoot most. Those two gradients
 * are most of what makes a body read as connected.
 *
 * ## State is three continuous axes, not eight discrete poses
 *
 * Eight flat states means 56 hand-authored transitions, and that is why the old
 * implementation popped on every change: SVG transform *attributes* snap. Here
 * `mood` and `arousal` are springs, everything visible derives from them, and
 * changing state mid-transition **retargets** rather than restarting. Non-jarring
 * transitions fall out of the structure instead of being animated one by one.
 */
export type RoyState =
  | "idle"
  | "greeting"
  | "ready"
  | "win-small"
  | "win-big"
  | "concerned"
  | "sleeping"
  | "thinking";

interface RoyProps {
  state?: RoyState;
  size?: number;
  accent?: string;
  className?: string;
  /** Reacts to hover/tap — use for nav and chrome placements. */
  interactive?: boolean;
  /** Overrides the size-derived detail level. Rarely needed. */
  detail?: Detail;
}

const FUR = "#2E3A4B";
const BELLY = "#E8ECF1";
const LINE = "#0E1420";

/* ── Motion tokens ──────────────────────────────────────────────────────────
 * Productive curves for anything that doubles as UI feedback; expressive for
 * anything that is purely character. Borrowed from IBM Carbon, because the
 * cheapest way to make a mascot read as part of an enterprise system rather
 * than bolted onto it is to move at the system's cadence.
 */
const EASE = {
  productive: [0.2, 0, 0.38, 0.9],
  expressive: [0.4, 0.14, 0.3, 1],
  entrance: [0, 0, 0.3, 1],
  exit: [0.2, 0, 1, 0.9],
} as const;

/**
 * Spring configs. ζ = damping / (2·√(stiffness·mass)).
 * The comment on each line is the resulting damping ratio and settle time —
 * these are tuned as a set, so changing one in isolation breaks the gradient.
 */
const RIG = {
  body: { stiffness: 260, damping: 30, mass: 1.1 }, //  ζ0.89  settle 0.29s
  mouth: { stiffness: 420, damping: 34, mass: 0.8 }, // ζ0.93  settle 0.19s
  head: { stiffness: 300, damping: 26, mass: 1.0 }, //  ζ0.75  settle 0.31s
  earL: { stiffness: 180, damping: 12, mass: 0.6 }, //  ζ0.58  settle 0.40s
  earR: { stiffness: 165, damping: 11.5, mass: 0.62 }, // ζ0.57 settle 0.42s — 8% off earL on purpose
  tail: { stiffness: 150, damping: 13, mass: 1.2 }, //  ζ0.49  settle 0.74s
} as const;


/* ── Geometry ───────────────────────────────────────────────────────────────
 * Shared by the animated and static renderers so the two can never drift — a
 * character whose reduced-motion version is a slightly different animal is a
 * bug nobody notices until someone screenshots both.
 *
 * Refined from the AB-Maps original after seeing it at 64px and above, where
 * three things that read fine at 22px stopped working: the muzzle patch spanned
 * most of the face and read as a wide grin, the ears were sharp isosceles
 * triangles and read as a bat rather than a fox, and the belly was wide enough
 * to look like a bib. Arctic foxes have short rounded ears, which is both more
 * accurate and the fix for the bat problem.
 */
const P = {
  body: "M 22 80 Q 22 62 35 60 L 65 60 Q 78 62 78 80 L 78 92 L 22 92 Z",
  belly: "M 33 80 Q 33 70 40 68 L 60 68 Q 67 70 67 80 L 67 92 L 33 92 Z",
  head: "M 22 38 Q 22 22 50 18 Q 78 22 78 38 L 78 56 Q 70 66 50 66 Q 30 66 22 56 Z",
  muzzle: "M 42 54 Q 42 65.5 50 66.5 Q 58 65.5 58 54 Q 50 51.5 42 54 Z",
  earL: "M 23 31 Q 23.5 18 30.5 15 Q 37 19 38 31 Z",
  earLInner: "M 27 29 Q 27.5 22 31 20 Q 34 23 34.5 29 Z",
  earR: "M 62 31 Q 63 19 69.5 15 Q 76.5 18 77 31 Z",
  earRInner: "M 65.5 29 Q 66 23 69 20 Q 72.5 22 73 29 Z",
  tail: "M 78 78 Q 92 70 88 56 Q 86 50 82 54 Q 86 62 78 70 Z",
  tailTip: "M 84 53 Q 86 50 82 54 Q 81 56 84 53 Z",
  tailCurled: "M 75 88 Q 90 88 88 78 Q 86 72 80 76",
  mouth: "M 46.5 61 Q 50 63 53.5 61",
  happyEyeL: "M 34 47 Q 38 43 42 47",
  happyEyeR: "M 58 47 Q 62 43 66 47",
} as const;

/** Ears, drawn once. Inner shape gives the silhouette depth at larger sizes. */
function Ear({ side }: { side: "l" | "r" }) {
  return (
    <>
      <path d={side === "l" ? P.earL : P.earR} fill={FUR} stroke={LINE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={side === "l" ? P.earLInner : P.earRInner} fill={BELLY} opacity={0.42} />
    </>
  );
}

type Detail = "static" | "coarse" | "full";

/**
 * The viewBox is 100 units. At `size=22` one unit is 0.22 CSS px, so the old
 * 2-unit idle bob was 0.44px — not motion, just antialiasing shimmer. Small
 * instances are logos and hold still.
 */
function detailFor(size: number): Detail {
  if (size < 28) return "static";
  if (size < 40) return "coarse";
  return "full";
}

interface Axes {
  mood: number; // -1 concerned … 0 neutral … +1 pleased
  arousal: number; // 0 asleep … 0.32 idle … 0.68 attentive … 1 celebrating
  gaze: [number, number];
  overlay: "none" | "sleep" | "think";
  /** Happy arcs replace the pupils. Topology changes, so it cuts under a blink. */
  eyesClosedHappy: boolean;
}

const POSES: Record<RoyState, Axes> = {
  sleeping: { mood: 0.1, arousal: 0.0, gaze: [0, 0.4], overlay: "sleep", eyesClosedHappy: false },
  idle: { mood: 0.1, arousal: 0.32, gaze: [0, 0], overlay: "none", eyesClosedHappy: false },
  thinking: { mood: 0.0, arousal: 0.5, gaze: [1.4, -0.5], overlay: "think", eyesClosedHappy: false },
  ready: { mood: 0.3, arousal: 0.68, gaze: [0, -0.8], overlay: "none", eyesClosedHappy: false },
  greeting: { mood: 0.6, arousal: 0.72, gaze: [0, -0.6], overlay: "none", eyesClosedHappy: false },
  concerned: { mood: -0.7, arousal: 0.55, gaze: [0, 1.6], overlay: "none", eyesClosedHappy: false },
  "win-small": { mood: 0.8, arousal: 0.8, gaze: [0, 0], overlay: "none", eyesClosedHappy: true },
  "win-big": { mood: 1.0, arousal: 1.0, gaze: [0, 0], overlay: "none", eyesClosedHappy: true },
};

/* ── Blink ──────────────────────────────────────────────────────────────────
 * Adult blink rate is ~17/min at rest with inter-blink intervals of 2–10s,
 * dropping to ~5/min under sustained focus. A blink lasts 100–150ms and is
 * *asymmetric*: lids slam shut and lift slowly. A symmetric blink on a fixed
 * interval is the most common amateur tell there is.
 *
 * The previous implementation blinked exactly once, four seconds after mount,
 * and then never again for the life of the page — a bounded `repeat: 0` on a
 * 4.4s timeline with the blink at 90–98%. That reads as taxidermy.
 */
function nextBlinkDelay(): number {
  const mean = 2600;
  const refractory = 900;
  return Math.min(9000, refractory + -Math.log(1 - Math.random()) * mean);
}

/** Phase offset per instance, so two Røys on one screen never move in unison. */
let instanceSeq = 0;

export function Roy({
  state = "idle",
  size = 64,
  accent = "var(--ab-accent-9)",
  className,
  interactive = false,
  detail: detailProp,
}: RoyProps) {
  const reducedRaw = useReducedMotion();
  // `useReducedMotion` is null until the media query resolves; treating null as
  // "reduced" avoids flashing a frame of motion during hydration.
  const reduced = reducedRaw !== false;

  // The observer target must be the wrapper, not the <svg>: the svg element is
  // swapped when the component flips between its static and animated branches,
  // and an IntersectionObserver pointed at a detached node never fires again.
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const detail = detailProp ?? detailFor(size);
  const animated = detail !== "static" && !reduced && inView;

  const seq = React.useMemo(() => instanceSeq++, []);
  const pose = POSES[state];

  /* ── Axes. Springs, so a state change retargets instead of restarting. ── */
  const mood = useSpring(pose.mood, RIG.mouth);
  const arousal = useSpring(pose.arousal, RIG.body);
  React.useEffect(() => {
    mood.set(pose.mood);
    arousal.set(pose.arousal);
  }, [pose.mood, pose.arousal, mood, arousal]);

  /* ── Rig: one driver, followers with increasing lag. ── */
  const bodyY = useMotionValue(0);
  const headY = useFollowValue(bodyY, { type: "spring", ...RIG.head });
  const tailY = useFollowValue(bodyY, { type: "spring", ...RIG.tail });
  const earLY = useFollowValue(bodyY, { type: "spring", ...RIG.earL });
  const earRY = useFollowValue(bodyY, { type: "spring", ...RIG.earR });

  // Rotation derived from lag — this *is* the follow-through, and it scales
  // with the size of the primary move for free.
  const tailLag = useTransform(() => (bodyY.get() - tailY.get()) * -2.6);
  const headLag = useTransform(() => (bodyY.get() - headY.get()) * 0.55);
  const earLLag = useTransform(() => (bodyY.get() - earLY.get()) * 1.9);
  const earRLag = useTransform(() => (bodyY.get() - earRY.get()) * 1.75);

  /* ── Pose, derived from the axes. ── */
  const earBase = useTransform(arousal, [0, 0.32, 0.68, 1], [10, 2, -7, -11]);
  const headTiltBase = useTransform(mood, [-1, 0, 1], [4.5, 0, -3]);
  const tailBase = useTransform(() => -6 + mood.get() * 10 + arousal.get() * 14);

  const earLRot = useTransform(() => -earBase.get() + earLLag.get());
  const earRRot = useTransform(() => earBase.get() + earRLag.get());
  const headRot = useTransform(() => headTiltBase.get() + headLag.get());
  const tailRot = useTransform(() => tailBase.get() + tailLag.get());

  // Volume conservation at 0.7 rather than 1.0 — perfect conservation looks
  // rubbery, none looks like the character merely got smaller.
  const bodyScaleY = useTransform(bodyY, (y) => 1 - y * 0.004);
  const bodyScaleX = useTransform(bodyScaleY, (sy) => Math.pow(sy, -0.7));

  // Mouth: one path across the whole emotional range. Negative scaleY flips the
  // smile into a frown, so no path morphing and no artwork swapping is needed.
  const mouthScaleY = useTransform(mood, [-1, 0, 1], [-0.85, 0.18, 2.0]);
  const mouthY = useTransform(mood, [-1, 0, 1], [1.6, 0, -0.6]);

  /* ── Gaze. Ballistic saccades with a hold, never smooth pursuit. ── */
  const gazeX = useSpring(pose.gaze[0], { stiffness: 700, damping: 40 });
  const gazeY = useSpring(pose.gaze[1], { stiffness: 700, damping: 40 });
  React.useEffect(() => {
    gazeX.set(pose.gaze[0]);
    gazeY.set(pose.gaze[1]);
  }, [pose.gaze, gazeX, gazeY]);

  /* ── Blink. Exponential schedule, asymmetric close/open. ── */
  const lid = useMotionValue(1);
  React.useEffect(() => {
    if (!animated || state === "sleeping" || pose.eyesClosedHappy) {
      lid.set(1);
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const blinkOnce = async () => {
      // Close fast, hold, open slow — opening is ~1.8x the close. A symmetric
      // blink on a fixed interval is the most common amateur tell there is.
      await animate(lid, 0.06, { duration: 0.062, ease: [0.55, 0, 1, 0.45] });
      if (!alive) return;
      await animate(lid, 1, { duration: 0.115, ease: [0, 0.6, 0.3, 1] });
    };

    const schedule = () => {
      timer = setTimeout(async () => {
        if (!alive) return;
        await blinkOnce();
        // ~15% of blinks come in pairs. Cheap, and a large realism win.
        if (alive && Math.random() < 0.15) {
          await new Promise((r) => setTimeout(r, 180 + Math.random() * 140));
          if (alive) await blinkOnce();
        }
        if (alive) schedule();
      }, nextBlinkDelay());
    };

    timer = setTimeout(schedule, 400 + seq * 230);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [animated, state, pose.eyesClosedHappy, lid, seq]);

  /* ── Spontaneous motion: a small, de-escalating budget, then stillness. ── */
  React.useEffect(() => {
    if (!animated) {
      bodyY.set(0);
      return;
    }
    let alive = true;
    let beat = 0;
    const budget = state === "win-big" ? 3 : state === "win-small" ? 2 : 1;
    const amplitude = () =>
      (state === "win-big" ? 9 : state === "win-small" ? 5 : 2.4) * Math.pow(0.6, beat);

    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      if (!alive || beat >= budget) return;
      const amp = amplitude();
      animate(bodyY, [0, -amp, 0], {
        duration: 0.62 * Math.pow(0.85, beat),
        ease: EASE.expressive,
      });
      beat += 1;
      timer = setTimeout(run, 1400 + seq * 120);
    };
    // Lead with the state change itself, offset per instance so two Roys on one
    // screen never move in unison.
    timer = setTimeout(run, 60 + seq * 90);
    return () => {
      alive = false;
      clearTimeout(timer);
      animate(bodyY, 0, { duration: 0.2 });
    };
  }, [animated, state, bodyY, seq]);

  const wrapStyle: React.CSSProperties = {
    width: size,
    height: size,
    display: "inline-block",
    position: "relative",
    cursor: interactive ? "pointer" : undefined,
  };

  return (
    <motion.span
      ref={ref}
      data-roy
      data-state={state}
      data-detail={detail}
      data-animated={String(animated)}
      className={className}
      style={wrapStyle}
      whileHover={interactive ? { scale: 1.08 } : undefined}
      whileTap={interactive ? { scale: 0.94 } : undefined}
      transition={{ duration: 0.12, ease: EASE.productive }}
    >
      {/*
        Reduced motion and tiny sizes get a *pose*, not a frozen animation.
        Three states used to render pixel-identical without motion, which made
        the distinction unavailable to anyone who cannot have it. The wrapper
        stays the same element either way so the observer target never detaches.
      */}
      {!animated ? (
        <StaticRoy state={state} size={size} accent={accent} />
      ) : (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
        {/* Body group. Origin at the feet: squashing around the centre makes a
            character look like it is floating; squashing at ground contact
            gives it weight. Biggest single-line improvement available. */}
        <motion.g
          style={{
            y: bodyY,
            scaleY: bodyScaleY,
            scaleX: bodyScaleX,
            originX: "50%",
            originY: "100%",
          }}
        >
          <path d={P.body} fill={FUR} />
          <path d={P.belly} fill={BELLY} />

          {/* Tail — the longest settle in the rig, so it always arrives last. */}
          <motion.g style={{ rotate: tailRot, originX: "78%", originY: "80%" }}>
            {state === "sleeping" ? (
              <path d={P.tailCurled} fill={FUR} stroke={LINE} strokeWidth="0.6" />
            ) : (
              <path d={P.tail} fill={FUR} stroke={LINE} strokeWidth="0.6" />
            )}
            <path d={P.tailTip} fill={BELLY} />
          </motion.g>

          {/* Head group carries the ears, so a head tilt swings them too. */}
          <motion.g style={{ rotate: headRot, originX: "50%", originY: "66%" }}>
            {/* Ears rotate at their base, not their centre. */}
            <motion.g style={{ rotate: earLRot, originX: "30%", originY: "100%" }}>
              <Ear side="l" />
            </motion.g>
            <motion.g style={{ rotate: earRRot, originX: "70%", originY: "100%" }}>
              <Ear side="r" />
            </motion.g>

            <path d={P.head} fill={FUR} stroke={LINE} strokeWidth="0.8" strokeLinejoin="round" />
            <path d={P.muzzle} fill={BELLY} />
            <ellipse cx="50" cy="56" rx="2.1" ry="1.5" fill={LINE} />

            <Eyes
              state={state}
              lid={lid}
              gazeX={gazeX}
              gazeY={gazeY}
              happy={pose.eyesClosedHappy}
              detail={detail}
            />

            {/* One mouth path for every mood. Negative scaleY flips it. */}
            <motion.path
              d={P.mouth}
              stroke={LINE}
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              style={{ scaleY: mouthScaleY, y: mouthY }}
            />
          </motion.g>
        </motion.g>

        {/* Thinking dots — motion elements, not SMIL. SMIL runs on the main
            thread, is not reliably interruptible, and cannot participate in
            the state machine. */}
        {pose.overlay === "think" && (
          <g>
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                cx={78 + i * 6}
                cy={22 - i * 2}
                r="1.6"
                fill={accent}
                initial={{ opacity: 0.25 }}
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.2, repeat: 3, delay: i * 0.18, ease: "easeInOut" }}
              />
            ))}
          </g>
        )}
      </svg>
      )}
    </motion.span>
  );
}

/**
 * Eyes. A solid dot has no readable gaze direction — offsetting it just reads
 * as the whole head shifting — so the pupil sits in a sclera and moves within
 * it. Gaze is the richest source of "alive" per byte in the whole character.
 */
function Eyes({
  state,
  lid,
  gazeX,
  gazeY,
  happy,
  detail,
}: {
  state: RoyState;
  lid: MotionValue<number>;
  gazeX: MotionValue<number>;
  gazeY: MotionValue<number>;
  happy: boolean;
  detail: Detail;
}) {
  if (state === "sleeping") {
    return (
      <>
        <line x1="34" y1="46" x2="42" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="46" x2="66" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (happy) {
    return (
      <>
        <path d={P.happyEyeL} stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d={P.happyEyeR} stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    );
  }

  const showSclera = detail === "full";

  return (
    // Lid closes toward the lower edge, so it reads as an eyelid coming down
    // rather than the eye shrinking to its centre. (The previous version set
    // originX/Y in px against `transform-box: fill-box`, which put the pivot
    // roughly 35 units below and right of the eyes — the "blink" squashed them
    // sideways.)
    <motion.g style={{ scaleY: lid, originX: "50%", originY: "82%" }}>
      {showSclera && (
        <>
          <circle cx="38" cy="46" r="3.7" fill={BELLY} />
          <circle cx="62" cy="46" r="3.7" fill={BELLY} />
        </>
      )}
      <motion.circle cx="38" cy="46" r={showSclera ? 2.15 : 3} fill={LINE} style={{ x: gazeX, y: gazeY }} />
      <motion.circle cx="62" cy="46" r={showSclera ? 2.15 : 3} fill={LINE} style={{ x: gazeX, y: gazeY }} />
    </motion.g>
  );
}

/* ── Static poses ───────────────────────────────────────────────────────────
 * Under reduced motion the old build dropped `animate` entirely, which made
 * `idle`, `ready` and `greeting` render pixel-identical: three system states
 * collapsed into one image. That is an accessibility defect, not a polish gap —
 * motion was the sole carrier of the distinction.
 *
 * Differentiation moves into *pose*. Ear angle carries more state on a fox than
 * anything else; tail angle is the second channel; gaze direction is the
 * strongest "processing" signal available and needs no motion at all.
 */
const STATIC_POSE: Record<
  RoyState,
  { ear: number; head: number; tail: number; mouth: number; gaze: [number, number]; y: number }
> = {
  sleeping: { ear: 8, head: 2, tail: -18, mouth: 0.0, gaze: [0, 0], y: 1 },
  idle: { ear: 0, head: 0, tail: -6, mouth: 0.1, gaze: [0, 0], y: 0 },
  thinking: { ear: -3, head: 5, tail: -4, mouth: 0.0, gaze: [1.4, -0.5], y: 0 },
  ready: { ear: -8, head: -3, tail: 8, mouth: 0.3, gaze: [0, -0.8], y: -1 },
  greeting: { ear: -12, head: -6, tail: 20, mouth: 0.6, gaze: [0, -0.6], y: -1 },
  concerned: { ear: 14, head: 4, tail: -14, mouth: -0.7, gaze: [0, 1.6], y: 0 },
  "win-small": { ear: -6, head: 2, tail: 22, mouth: 0.8, gaze: [0, 0], y: -2 },
  "win-big": { ear: -10, head: 3, tail: 35, mouth: 1.0, gaze: [0, 0], y: -3 },
};

function StaticRoy({ state, size, accent }: { state: RoyState; size: number; accent: string }) {
  const p = STATIC_POSE[state];
  const happy = state === "win-small" || state === "win-big";
  const mouthScaleY = p.mouth < 0 ? -0.85 : 0.18 + p.mouth * 1.82;
  const mouthY = p.mouth < 0 ? 1.6 : -p.mouth * 0.6;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
      <g transform={`translate(0 ${p.y})`}>
        <path d={P.body} fill={FUR} />
        <path d={P.belly} fill={BELLY} />

        <g transform={`rotate(${p.tail} 78 76)`}>
          {state === "sleeping" ? (
            <path d={P.tailCurled} fill={FUR} stroke={LINE} strokeWidth="0.6" />
          ) : (
            <path d={P.tail} fill={FUR} stroke={LINE} strokeWidth="0.6" />
          )}
        </g>

        <g transform={`rotate(${p.head} 50 55)`}>
          <g transform={`rotate(${-p.ear} 30 31)`}>
            <Ear side="l" />
          </g>
          <g transform={`rotate(${p.ear} 70 31)`}>
            <Ear side="r" />
          </g>

          <path d={P.head} fill={FUR} stroke={LINE} strokeWidth="0.8" strokeLinejoin="round" />
          <path d={P.muzzle} fill={BELLY} />
          <ellipse cx="50" cy="56" rx="2.1" ry="1.5" fill={LINE} />

          {state === "sleeping" ? (
            <>
              <line x1="34" y1="46" x2="42" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
              <line x1="58" y1="46" x2="66" y2="46" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
            </>
          ) : happy ? (
            <>
              <path d={P.happyEyeL} stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <path d={P.happyEyeR} stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              {size >= 40 && (
                <>
                  <circle cx="38" cy="46" r="3.7" fill={BELLY} />
                  <circle cx="62" cy="46" r="3.7" fill={BELLY} />
                </>
              )}
              <circle cx={38 + p.gaze[0]} cy={46 + p.gaze[1]} r={size >= 40 ? 2.15 : 3} fill={LINE} />
              <circle cx={62 + p.gaze[0]} cy={46 + p.gaze[1]} r={size >= 40 ? 2.15 : 3} fill={LINE} />
            </>
          )}

          <g transform={`translate(0 ${mouthY})`}>
            <path
              d={P.mouth}
              stroke={LINE}
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              style={{ transformBox: "fill-box", transformOrigin: "50% 50%", transform: `scaleY(${mouthScaleY})` }}
            />
          </g>
        </g>
      </g>

      {state === "thinking" && (
        <g>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={78 + i * 6} cy={22 - i * 2} r="1.6" fill={accent} opacity={0.35 + i * 0.25} />
          ))}
        </g>
      )}
    </svg>
  );
}

export default Roy;
