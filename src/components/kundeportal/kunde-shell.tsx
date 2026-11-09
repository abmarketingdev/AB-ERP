"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Mascot } from "@/components/patterns/mascot";
import { MascotLoadingScreen } from "@/components/patterns/mascot-loading";
import { Button } from "@/components/ui/button";
import { kundeLogout, useKundeMe, useKundeToken } from "@/lib/kundeportal/api";

/** Sider uten innlogging. Alt annet under /kunde krever kundens økt. */
const PUBLIC = ["/kunde/login", "/kunde/sett-passord"];

export function KundeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return <Guarded>{children}</Guarded>;
}

function Guarded({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useKundeToken();
  const me = useKundeMe();
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    if (hydrated && !token) router.replace("/kunde/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token || me.isPending) return <MascotLoadingScreen theme="light" label="Henter kontoen din…" />;
  if (me.isError || !me.data) return <MascotLoadingScreen theme="light" label="Sender deg til innlogging…" />;

  async function logout() {
    await kundeLogout(token);
    router.replace("/kunde/login");
  }

  return (
    <div className="light relative flex min-h-screen flex-col bg-background">
      <a href="#hovedinnhold"
        className="sr-only left-3 top-3 z-50 rounded-md bg-[var(--ab-accent-9)] px-3 py-2 text-[13px] font-medium text-[var(--ab-accent-12)] focus:not-sr-only focus:absolute focus:outline-none focus:ring-2 focus:ring-ring">
        Hopp til innholdet
      </a>
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-8 print:hidden">
        <div className="flex items-center gap-2.5">
          <Mascot state="idle" size={30} />
          <div>
            <p className="text-sm font-medium text-foreground">AB Marketing — Kundeportal</p>
            <p className="text-xs text-muted-foreground">{me.data.organisation}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{me.data.name || me.data.email}</span>
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Logg ut">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main id="hovedinnhold" tabIndex={-1} className="flex flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-8">
        {children}
      </main>
    </div>
  );
}
