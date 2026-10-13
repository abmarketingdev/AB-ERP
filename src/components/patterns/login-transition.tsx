"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { MascotLoading } from "./mascot-loading";

interface LoginTransitionProps {
  active: boolean;
  label: string;
}

/**
 * Full-screen takeover shown while a login is processing — bridges the gap
 * between clicking a demo user and the shell mounting, instead of jumping
 * straight to a blank page.
 *
 * The previous version wrapped the mascot in an infinite `y: [0, -10, 0]` bob.
 * That was a wrapper animation, so it bypassed the mascot's own reduced-motion
 * handling entirely — and Motion's JS-driven transforms are not caught by the
 * global `animation-duration` override in `globals.css` either, meaning someone
 * who asked for no motion got a bouncing mascot anyway. The greeting loop now
 * carries the motion, inside the component that knows the rules.
 */
export function LoginTransition({ active, label }: LoginTransitionProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background dark"
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
          <div className="relative z-10">
            <MascotLoading label={label} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
