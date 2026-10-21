"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/patterns/mascot";
import { MascotLoadingScreen } from "@/components/patterns/mascot-loading";
import { clearSessionKey, useSessionGuard } from "@/lib/use-session-guard";
import { useAccess } from "@/lib/use-access";
import { mascotFor } from "@/lib/use-mascot";

/**
 * Signed in, but given no modules yet (SRS §2.2 «Admin velger hvilke moduler hver bruker
 * har»). Superuser grants nothing in recruitment, so a Maps admin opening the ERP for the
 * first time lands here — not on a broken menu or a generic 403. The one useful thing to
 * say is who to ask; the one useful action is to check again once they have.
 */
export default function IngenTilgang() {
  const router = useRouter();
  const { session } = useSessionGuard();
  const { access, refetch, isFetching } = useAccess();

  React.useEffect(() => {
    // Access was granted meanwhile: go to the first screen they may see.
    if (session && session.navigation.length > 0) router.replace(session.navigation[0].href);
  }, [session, router]);

  if (!session) return <MascotLoadingScreen label="Henter tilgangene dine…" />;

  const m = mascotFor("forbidden");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <Mascot {...m} size={112} />
        <div className="space-y-2">
          <h1 className="text-2xl font-medium">Ingen moduler ennå</h1>
          <p className="text-base text-muted-foreground">
            {access?.message ?? "Du har ikke fått tilgang til noen moduler ennå — kontakt Lars eller Joseph."}
          </p>
          <p className="text-sm text-muted-foreground">
            Du er logget inn som <span className="font-medium text-foreground">{access?.username ?? session.name}</span>.
            Be om tilgang til modulene du trenger, så dukker de opp her.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="min-h-11" disabled={isFetching} onClick={() => void refetch().then(() => router.refresh())}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
            {isFetching ? "Sjekker…" : "Sjekk på nytt"}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => { clearSessionKey(); router.replace("/login"); }}>
            <LogOut className="size-4" aria-hidden /> Logg ut
          </Button>
        </div>
      </div>
    </main>
  );
}
