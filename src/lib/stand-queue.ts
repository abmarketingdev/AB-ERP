"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/client";

/**
 * LEAD-05 / IFK-08 — a stand is outdoors, often on bad signal. A lead the promotor
 * typed must not be lost to a dropped connection, so a failed send is queued on the
 * phone and retried until the server has it.
 *
 * Each entry carries the `clientId` it was first sent with, and the server is
 * idempotent on it: a retry that crosses a slow first attempt still makes one lead.
 * Only network failures and 5xx are queued — a 4xx is the form's fault and is shown
 * to the promotor instead. localStorage can throw (private mode, blocked storage),
 * so every access is guarded and the page still works without it.
 */
const KEY = "ab-erp:stand-queue:v1";
const RETRY_MS = 30_000;

export type QueuedLead = { clientId: string; payload: Record<string, unknown>; queuedAt: string };

function read(): QueuedLead[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedLead[];
  } catch {
    return [];
  }
}

function write(items: QueuedLead[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: the in-memory list still drives the UI this session */
  }
}

export function isRetryable(err: unknown) {
  if (err instanceof ApiError) return err.status >= 500 || err.status === 0;
  return err instanceof TypeError; // fetch's network failure
}

export function useStandQueue(send: (item: QueuedLead) => Promise<unknown>) {
  const [items, setItems] = React.useState<QueuedLead[]>([]);
  const sending = React.useRef(false);

  React.useEffect(() => setItems(read()), []);

  const enqueue = React.useCallback((item: QueuedLead) => {
    const next = [...read().filter((i) => i.clientId !== item.clientId), item];
    write(next);
    setItems(next);
  }, []);

  const flush = React.useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      for (const item of read()) {
        try {
          await send(item);
        } catch (err) {
          if (isRetryable(err)) break;          // still offline: keep the rest for later
        }
        // Sent, or refused for good (4xx): either way it leaves the queue.
        const rest = read().filter((i) => i.clientId !== item.clientId);
        write(rest);
        setItems(rest);
      }
    } finally {
      sending.current = false;
    }
  }, [send]);

  React.useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void flush(), RETRY_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  return { pending: items.length, enqueue, flush };
}

export function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
