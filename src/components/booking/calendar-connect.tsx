"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarX2, X } from "lucide-react";
import { IS_MOCK } from "@/lib/data-source";
import { useHasPermission } from "@/lib/permissions";
import { useCalendarWeek } from "@/lib/api/interviews";
import type { CalendarWeek as Week } from "@/types/interview";
import { todayOslo } from "./week-slot-picker";

/**
 * Why a person's Google Calendar is not connected, worded for them (client 2026-11-03):
 * most leaders were registered with a gmail/hotmail address, which the company's Google
 * Workspace cannot reach. They are told which address is on file and to have it changed
 * to their @abmarketing.no address — instead of the integration raising alarms.
 */

const UNREACHABLE = ["no_email", "outside_workspace", "not_in_workspace"];
export const isUnreachable = (week?: Pick<Week, "reason"> | null) => !!week && UNREACHABLE.includes(week.reason);

export function ownCalendarProblem(reason: string, email: string): { title: string; body: string } | null {
  switch (reason) {
    case "outside_workspace":
      return {
        title: "Google Kalenderen din er ikke koblet",
        body: `E-postadressen din i systemet er ${email}. Det er ikke en AB Marketing Google-adresse, så kalenderen din kan ikke vises her, og intervjuer legges ikke automatisk inn i kalenderen din. Be en administrator endre e-postadressen din til din @abmarketing.no-adresse.`,
      };
    case "not_in_workspace":
      return {
        title: "Google Kalenderen din er ikke koblet",
        body: `${email} finnes ikke i AB Marketings Google-konto. Be en administrator sjekke at adressen er riktig, eller opprette deg i Google Workspace.`,
      };
    case "no_email":
      return {
        title: "Google Kalenderen din er ikke koblet",
        body: "Du har ingen e-postadresse registrert. Be en administrator legge inn din @abmarketing.no-adresse.",
      };
    default:
      return null;
  }
}

/** One line for someone looking at another person's calendar. */
export function otherCalendarProblem(reason: string, name?: string): string | null {
  const who = name ?? "Lederen";
  switch (reason) {
    case "outside_workspace": return `${who} har ikke en AB Marketing Google-adresse`;
    case "not_in_workspace": return `${who} finnes ikke i AB Marketings Google-konto`;
    case "no_email": return `${who} mangler e-postadresse`;
    default: return null;
  }
}

/** The box on «Min kalender» (own calendar only). */
export function CalendarConnectNotice({ week }: { week: Week }) {
  if (!week.own) return null;
  const p = ownCalendarProblem(week.reason, week.email);
  if (!p) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
      <CalendarX2 className="mt-0.5 size-5 shrink-0 text-warning-on-tint" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{p.title}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{p.body}</p>
      </div>
    </div>
  );
}

const DISMISS_KEY = "ab-calendar-connect-dismissed";
const DISMISS_FOR = 24 * 3600_000;

/**
 * Above every screen for a person whose own calendar cannot be connected, so they see it
 * when they log in — not only if they open «Min kalender». Hidden for a day when closed.
 */
export function CalendarConnectBanner() {
  const allowed = useHasPermission("mycalendar.view");
  return IS_MOCK || !allowed ? null : <Banner />;
}

function Banner() {
  const [closedNow, setClosedNow] = React.useState(false);
  // localStorage is read on the client only; the server render treats it as dismissed.
  const dismissedEarlier = React.useSyncExternalStore(
    () => () => {},
    () => Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_FOR,
    () => true,
  );
  const dismissed = closedNow || dismissedEarlier;
  const setDismissed = setClosedNow;
  const q = useCalendarWeek("", todayOslo(), 1, !dismissed);
  const week = q.data;
  if (dismissed || !week || !week.own || !isUnreachable(week)) return null;
  const p = ownCalendarProblem(week.reason, week.email);
  if (!p) return null;
  return (
    <div role="status" className="flex items-start gap-2.5 border-b border-warning/40 bg-warning/10 px-4 py-2 text-[13px] text-foreground">
      <CalendarX2 className="mt-0.5 size-4 shrink-0 text-warning-on-tint" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium">{p.title}.</span> {p.body}{" "}
        <Link href="/rekruttering/kalender" className="underline underline-offset-2">Min kalender</Link>
      </p>
      <button type="button" aria-label="Skjul i dag" className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        onClick={() => { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); setDismissed(true); }}>
        <X className="size-4" />
      </button>
    </div>
  );
}
