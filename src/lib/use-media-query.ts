"use client";

import * as React from "react";

/** Subscribes to a media query. Server render and first paint assume `false`. */
export function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phone layout (IFK-08): below the `sm` breakpoint. */
export const usePhone = () => useMediaQuery("(max-width: 639px)");
