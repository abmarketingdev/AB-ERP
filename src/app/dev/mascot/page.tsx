"use client";

import * as React from "react";
import { Mascot, type MascotPose, type MascotState } from "@/components/patterns/mascot";
import { MascotLoading } from "@/components/patterns/mascot-loading";
import { Button } from "@/components/ui/button";

/**
 * Component gallery for the mascot — every pose, every tier, on one screen.
 *
 * This exists because a character can only be judged in comparison. Reviewing
 * poses one at a time, on whichever screen happens to mount one, is how you end
 * up with three states that look identical and nobody notices.
 *
 * It is also the only reliable way to *test* the set: incidental placements are
 * the wrong sizes, sometimes zero-width, and never cover all 27.
 */

/** The pack's own captions. They are the reason the mapping is what it is. */
const POSES: { pose: MascotPose; use: string; loop?: boolean }[] = [
  { pose: "standing", use: "standard, laster, hilsen", loop: true },
  { pose: "clipboard", use: "kvalitetssjekk / sjekkliste", loop: true },
  { pose: "flying-a-kite", use: "mål nådd", loop: true },
  { pose: "guitar", use: "feiring", loop: true },
  { pose: "teamwork", use: "team og mål", loop: true },
  { pose: "campfire", use: "kveldsrapport", loop: true },
  { pose: "cloudwatching", use: "ingen data / tom tilstand" },
  { pose: "light-work", use: "tomt skjema" },
  { pose: "meeting-chaos", use: "feil, travel uke" },
  { pose: "manager", use: "leder-dashboard" },
  { pose: "building", use: "under arbeid" },
  { pose: "lounging", use: "inaktiv sesjon" },
  { pose: "reading", use: "nyheter" },
  { pose: "whiteboard", use: "opplæring, kurs" },
  { pose: "research-development", use: "analyse" },
  { pose: "hammock", use: "ferie" },
  { pose: "yoga", use: "pust ut" },
  { pose: "delivery", use: "salg levert" },
  { pose: "video-call", use: "teammøte" },
  { pose: "prototyping", use: "ny funksjon" },
  { pose: "skateboard", use: "rask handling" },
  { pose: "designer", use: "tilpasning" },
  { pose: "painting", use: "kreativt" },
  { pose: "picnic", use: "lunsj" },
  { pose: "gaming", use: "pause" },
  { pose: "barbecue", use: "sosialt" },
  { pose: "commuting", use: "på farten" },
];

const STATES: MascotState[] = [
  "idle", "ready", "greeting", "thinking",
  "concerned", "win-small", "win-big", "sleeping",
];

const SIZES = [
  { size: 24, tier: "head crop — nav, holds still" },
  { size: 32, tier: "head crop — mobile bar" },
  { size: 56, tier: "full figure — empty states" },
  { size: 112, tier: "full figure — loading screens" },
];

export default function MascotGallery() {
  const [nonce, setNonce] = React.useState(0);
  const [state, setState] = React.useState<MascotState>("thinking");

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header>
          <h1 className="text-[22px]">Pandi</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Alle positurer, alle detaljnivåer. Utviklingsside — ikke en del av produktet.
          </p>
        </header>

        {/* Remount to replay the one-shots — the only way to see a `once`. */}
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

        <section className="flex flex-wrap items-center gap-8 rounded-xl border border-border bg-card p-6">
          <Mascot key={`hero-${nonce}`} state={state} size={140} />
          <div>
            <p className="font-mono text-[12px] text-muted-foreground">Gjeldende tilstand</p>
            <p className="mt-1 font-mono text-[20px] text-foreground">{state}</p>
            <p className="mt-2 max-w-sm text-[12.5px] text-muted-foreground">
              Bare tilstander som betyr «du venter på oss» går i løkke. Resten spilles én gang
              og blir stående, eller er stillbilder.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
            Lasteskjerm
          </h2>
          <div className="flex justify-center rounded-xl border border-border bg-card py-10">
            <MascotLoading key={`load-${nonce}`} label="Henter din side…" />
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
                  className="flex min-w-[120px] flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-4"
                  data-mascot-cell={`${size}-${s}`}
                >
                  <Mascot key={`${size}-${s}-${nonce}`} state={s} size={size} />
                  <span className="font-mono text-[10px] text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
            Alle 27 positurer — «løkke» betyr at det finnes en videofil
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {POSES.map(({ pose, use, loop }) => (
              <li
                key={pose}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3"
                data-mascot-pose={pose}
              >
                <Mascot key={`${pose}-${nonce}`} pose={pose} size={112} motion="still" />
                <span className="font-mono text-[10px] text-foreground">{pose}</span>
                <span className="text-center text-[10.5px] leading-tight text-muted-foreground">
                  {use}
                </span>
                {loop && (
                  <span className="rounded-full bg-[var(--ab-accent-9)]/12 px-2 py-0.5 font-mono text-[9px] text-[var(--ab-accent-11)]">
                    løkke
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <p className="font-mono text-[10.5px] text-muted-foreground">
          Under redusert bevegelse skal ingen video montere — positur bærer betydningen, ikke
          bevegelsen.
        </p>
      </div>
    </div>
  );
}
