"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MascotLoadingScreen } from "@/components/patterns/mascot-loading";
import { IS_MOCK } from "@/lib/data-source";

/**
 * Starts the mock service worker before any child can fire a request.
 *
 * Blocking the first render is deliberate: if children mount first, their
 * initial fetches escape the worker and every one of them 404s against the Next
 * dev server, which surfaces as "Fant ikke det du lette etter" on every card.
 *
 * Two failure modes are guarded here, both of which were observed:
 *  1. StrictMode double-invokes effects in development, and calling
 *     worker.start() twice throws "cannot configure an already enabled network".
 *     The start promise is therefore module-level, not per-component.
 *  2. worker.start() can resolve while the page is still not *controlled* by the
 *     service worker — typically on the very first registration, or when an old
 *     registration was evicted. Requests then bypass the worker silently. We
 *     detect that and reload once.
 *
 * Set NEXT_PUBLIC_DATA_SOURCE=api to run against a real gateway instead.
 */

let startPromise: Promise<void> | null = null;

const SCENARIO_KEY = "ab-erp-mock-scenario";
const RELOAD_KEY = "ab-erp-msw-reloaded";

/**
 * Switching demo scenario resets the store, so "healthy week" never inherits
 * writes made while demoing "several follow-ups needed".
 */
async function resetIfScenarioChanged() {
  if (typeof window === "undefined") return;
  const current = new URLSearchParams(window.location.search).get("scenario") ?? "";
  const previous = window.sessionStorage.getItem(SCENARIO_KEY);
  if (previous !== current) {
    const { resetDb } = await import("./db");
    resetDb();
    window.sessionStorage.setItem(SCENARIO_KEY, current);
  }
}

/** True once the service worker is actually intercepting this page's requests. */
function isControlled() {
  return typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
}

function startWorkerOnce(): Promise<void> {
  if (!startPromise) {
    startPromise = resetIfScenarioChanged()
      .then(() => import("./browser"))
      .then(({ worker }) =>
        worker.start({
          /*
           * Warn loudly for anything under /api/ that has no handler, instead of
           * letting it fall through to the network. There is no backend, so an
           * unhandled call is always a missing handler — and silently bypassing
           * is exactly how every card ends up showing "Fant ikke det du lette
           * etter" with no clue why. Everything else (Next assets, HMR) bypasses
           * quietly as normal.
           */
          onUnhandledRequest(request, print) {
            if (new URL(request.url).pathname.startsWith("/api/")) print.warning();
          },
          quiet: true,
          serviceWorker: { url: "/mockServiceWorker.js" },
        }),
      )
      .then(async () => {
        if (isControlled()) {
          window.sessionStorage.removeItem(RELOAD_KEY);
          return;
        }
        // Give the worker a moment to claim this client before giving up on it.
        await new Promise((r) => setTimeout(r, 300));
        if (isControlled()) {
          window.sessionStorage.removeItem(RELOAD_KEY);
          return;
        }
        // Still uncontrolled. One reload puts the page under the worker.
        // The sessionStorage guard makes this impossible to loop on.
        if (!window.sessionStorage.getItem(RELOAD_KEY)) {
          window.sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Never resolves — the page is going away.
          return new Promise<void>(() => {});
        }
        console.error(
          "[msw] the service worker is not controlling this page, so API calls will 404. " +
            "Unregister it in DevTools → Application → Service Workers, then reload.",
        );
      });
  }
  return startPromise;
}

export function MockProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = IS_MOCK;
  const [ready, setReady] = React.useState(!enabled);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    startWorkerOnce()
      .catch((err) => {
        // Never leave the app permanently blank because mocking failed.
        console.error("[msw] worker failed to start", err);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  /*
   * The worker takes a few hundred milliseconds to boot, and until it does
   * there is nothing to render. This used to `return null`, which meant the
   * very first thing anyone saw on a cold visit was a blank white page — the
   * app's real first impression, and the one screen nobody had designed.
   *
   * The theme is derived from the path because this mounts above the router's
   * layouts: the staff app is dark, the customer portal is light, and guessing
   * wrong flashes a full-screen colour change when the page arrives.
   */
  if (!ready) {
    return (
      <MascotLoadingScreen
        theme={pathname?.startsWith("/kunde") ? "light" : undefined}
        label="Starter AB ERP…"
      />
    );
  }
  return <>{children}</>;
}
