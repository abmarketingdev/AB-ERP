"use client";

import * as React from "react";
import { FlaskConical, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

/**
 * Says, on every screen, that none of this is real.
 *
 * The portal is shown to people who will make decisions about whether to build
 * it, on a domain the company owns, looking exactly like a working product. The
 * numbers are invented and internally consistent, which is precisely what makes
 * them easy to quote by accident. One quiet, permanent marker is cheaper than
 * the conversation that follows somebody repeating a figure from here in a
 * board meeting.
 *
 * Dismissable per session, because during a long demo it is in the way once it
 * has been read — but it comes back on the next visit rather than being
 * silenced for good.
 */

const KEY = "ab-erp-mock-badge-dismissed";

export function MockBadge() {
  const [hidden, setHidden] = React.useState(true);
  const scenario = useSearchParams().get("scenario");

  React.useEffect(() => {
    try {
      setHidden(window.sessionStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  function dismiss() {
    setHidden(true);
    try { window.sessionStorage.setItem(KEY, "1"); } catch { /* no storage, no memory — fine */ }
  }

  if (hidden) return null;

  return (
    <div
      role="note"
      className="pointer-events-auto fixed bottom-3 right-3 z-40 flex max-w-[22rem] items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning-on-tint shadow-sm backdrop-blur-sm"
    >
      <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p className="flex-1">
        <span className="font-medium">Demo på testdata.</span>{" "}
        Alle navn, tall og kandidater er oppdiktet. Ingenting her er ekte.
        {scenario && <span className="block mt-0.5 opacity-80">Scenario: {scenario}</span>}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Skjul demovarselet"
        className="-m-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
