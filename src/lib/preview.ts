"use client";

import * as React from "react";

/**
 * "Forhåndsvis som" (FR-A-04/05/06): lets an admin see the platform as a
 * selected role or a selected customer account, with an unmistakable banner
 * throughout and an audit trail. Demo-only — a real implementation would
 * mint a short-lived impersonation token server-side; here the flag just
 * lives in localStorage and the session guards check it before falling back
 * to the normal login requirement.
 */

export interface PreviewTarget {
  type: "role" | "customer";
  key: string;
  label: string;
}

interface StoredPreview extends PreviewTarget {
  startedAt: string;
}

const STORAGE_KEY = "ab-erp-preview";
const EVENT = "ab-erp-preview-change";

export function readPreview(): StoredPreview | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function startPreview(target: PreviewTarget) {
  const stored: StoredPreview = { ...target, startedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  window.dispatchEvent(new Event(EVENT));
}

export function endPreview() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * localStorage is an external store, so React has a hook for exactly this.
 *
 * The previous version seeded state from an effect, which meant a first render
 * that said "no preview" followed immediately by a second that said otherwise —
 * a cascading render on every page, and a frame where the preview banner was
 * missing from a session that is in preview. `useSyncExternalStore` takes a
 * separate server snapshot instead, so the markup matches on hydration with no
 * round trip. Same pattern as the dismissed-corrections store.
 *
 * The snapshot has to be referentially stable, so the raw string is the
 * snapshot and parsing happens in `useMemo` — returning a fresh object from
 * `getSnapshot` would loop forever.
 */
const PREVIEW_EVENT = EVENT;

function subscribePreview(onChange: () => void) {
  window.addEventListener(PREVIEW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREVIEW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function previewSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function previewServerSnapshot(): string | null {
  return null;
}

export function usePreview(): StoredPreview | null {
  const raw = React.useSyncExternalStore(subscribePreview, previewSnapshot, previewServerSnapshot);
  return React.useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredPreview;
    } catch {
      return null;
    }
  }, [raw]);
}
