"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasPermission } from "@/lib/permissions";
import { Roy } from "./roy";

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * FR-S-05 — a view the user lacks permission for gets a stated refusal, never a
 * blank page and never a half-rendered one.
 *
 * The distinction matters more than it sounds: a partial render leaks the shape
 * of what is behind the wall, and a blank page reads as a bug, so the user
 * reloads, then files a ticket, then asks a colleague to check whether the
 * system is down. A sentence and a route out costs nothing and ends all three.
 */
export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const allowed = useHasPermission(permission);
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <NoAccess />}</>;
}

/**
 * The refusal itself.
 *
 * `homeHref` is the part that turns it from a wall into a detour. Somebody
 * lands here from a colleague's link, and the failure mode is not confusion
 * about permissions — it is being stuck on a page with nothing to press. The
 * link goes to the first item in *their own* navigation, so it is their home,
 * not a guess at one.
 *
 * The copy names no screen and no permission. Telling somebody exactly which
 * report they are missing is a small map of the thing they cannot see.
 */
export function NoAccess({ homeHref }: { homeHref?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Roy state="concerned" size={72} />
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">Ingen tilgang</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Du har ikke tilgang til denne siden. Kontakt din administrator hvis du mener dette er
          feil.
        </p>
      </div>
      {homeHref && (
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={homeHref}>
            <ArrowLeft className="size-3.5" aria-hidden />
            Tilbake til forsiden
          </Link>
        </Button>
      )}
    </div>
  );
}
