"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Mascot } from "@/components/patterns/mascot";

export type MascotMood = "greeting" | "ready" | "thinking" | "concerned";

/** Rammen rundt kundens innlogging og «sett passord» — samme uttrykk som demoen. */
export function KundeAuthFrame({ mood, children }: { mood: MascotMood; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <div className="light relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-10">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px 360px at 20% -10%, color-mix(in oklab, var(--ab-accent-9) 10%, transparent), transparent 65%), radial-gradient(700px 420px at 100% 100%, color-mix(in oklab, var(--ab-accent-11) 6%, transparent), transparent 70%)",
        }}
        animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascot state={mood} size={72} />
          <div>
            <h1 className="text-lg font-medium text-foreground">AB Marketing — Kundeportal</h1>
            <p className="text-sm text-muted-foreground">Rapporter for din organisasjon</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Kortet med ristebevegelse ved feil. */
export function AuthCard({ id, shake, children }: { id: string; shake: number; children: React.ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="w-full rounded-2xl border border-border bg-card p-8 shadow-lg"
    >
      {children}
    </motion.div>
  );
}
