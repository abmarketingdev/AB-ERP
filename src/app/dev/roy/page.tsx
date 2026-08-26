"use client";

import * as React from "react";
import { Roy, type RoyState } from "@/components/patterns/roy";
import { Button } from "@/components/ui/button";

/**
 * Component gallery for Røy — every state at every detail tier, on one screen.
 *
 * This exists because a character can only be judged in comparison. Reviewing
 * expressions one at a time, on whichever screen happens to mount one, is how
 * you end up with three states that look identical and nobody notices — which
 * is exactly what had happened under reduced motion.
 *
 * It is also the only reliable way to *test* the thing: incidental placements
 * are the wrong sizes, sometimes zero-width, and never cover the full set.
 */
const STATES: RoyState[] = [
  "idle",
  "ready",
  "greeting",
  "thinking",
  "concerned",
  "win-small",
  "win-big",
  "sleeping",
];

const SIZES = [
  { size: 22, tier: "static — a logo, holds still" },
  { size: 32, tier: "coarse — body + blink" },
  { size: 64, tier: "full — rig, gaze, sclera" },
];

export default function RoyGallery() {
  const [nonce, setNonce] = React.useState(0);
  const [state, setState] = React.useState<RoyState>("idle");

  return (
    <div className="dark min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header>
          <h1 className="text-[22px]">Røy</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Alle tilstander, alle detaljnivåer. Utviklingsside — ikke en del av produktet.
          </p>
        </header>

        {/* Remount to replay entrance beats — the only way to see a one-shot. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => setNonce((n) => n + 1)}>
            Spill av på nytt
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setState(s);
                  setNonce((n) => n + 1);
                }}
                aria-pressed={state === s}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${
                  state === s
                    ? "border-[var(--ab-accent-9)]/45 bg-[var(--ab-accent-9)]/12 text-[var(--ab-accent-11)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Transition rig: one big instance driven by the picker above, so a
            state change can be watched rather than inferred from a grid. */}
        <section className="flex items-center gap-6 rounded-xl border border-border bg-card p-6">
          <Roy key={`hero-${nonce}`} state={state} size={128} />
          <div>
            <p className="font-mono text-[12px] text-muted-foreground">Gjeldende</p>
            <p className="mt-1 font-mono text-[20px] text-foreground">{state}</p>
            <p className="mt-2 max-w-sm text-[12.5px] text-muted-foreground">
              Bytt tilstand for å se overgangen. Fjærene retter seg mot det nye målet i stedet for
              å starte på nytt, så en overgang midt i en annen overgang popper ikke.
            </p>
          </div>
        </section>

        {SIZES.map(({ size, tier }) => (
          <section key={size} className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
              {size}px — {tier}
            </h2>
            <ul className="flex flex-wrap gap-4">
              {STATES.map((s) => (
                <li
                  key={s}
                  className="flex min-w-[112px] flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-4"
                  data-roy-cell={`${size}-${s}`}
                >
                  <Roy key={`${size}-${s}-${nonce}`} state={s} size={size} />
                  <span className="font-mono text-[10px] text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="font-mono text-[10.5px] text-muted-foreground">
          Under redusert bevegelse skal alle åtte tilstandene fortsatt være mulige å skille fra
          hverandre — positur bærer betydningen, ikke bevegelsen.
        </p>
      </div>
    </div>
  );
}
