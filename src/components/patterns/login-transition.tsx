"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Roy } from "./roy";

interface LoginTransitionProps {
  active: boolean;
  label: string;
}

/** Full-screen takeover shown while a login is "processing" — bridges the
 * gap between clicking a demo user and the shell mounting, instead of
 * jumping straight to a blank page. */
export function LoginTransition({ active, label }: LoginTransitionProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background dark"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />

          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 -z-10 rounded-full bg-[var(--ab-accent-9)]/30 blur-2xl" />
            <Roy state="ready" size={96} accent="var(--ab-accent-9)" />
          </motion.div>

          <div className="relative z-10 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-[var(--ab-accent-9)]"
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
