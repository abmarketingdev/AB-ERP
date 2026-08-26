"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Roy } from "@/components/patterns/roy";
import { PreviewBanner } from "@/components/patterns/preview-banner";
import { Button } from "@/components/ui/button";
import { CustomerSessionProvider, useCustomerSessionGuard, clearCustomerToken } from "@/lib/customer-session";

function CustomerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { account, redirect } = useCustomerSessionGuard(pathname);

  React.useEffect(() => {
    if (redirect && pathname !== "/kunde/login") router.replace("/kunde/login");
  }, [redirect, pathname, router]);

  if (pathname === "/kunde/login") return <>{children}</>;

  if (account === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Roy state="thinking" size={44} />
      </div>
    );
  }
  if (!account) return null;

  function logout() {
    clearCustomerToken();
    router.replace("/kunde/login");
  }

  return (
    <CustomerSessionProvider account={account}>
      <div className="relative flex min-h-screen flex-col bg-background">
        {/* WCAG 2.4.1, the customer's version. Short header, but a keyboard
            user should still not have to tab through it to reach the report. */}
        <a
          href="#hovedinnhold"
          className="sr-only left-3 top-3 z-50 rounded-md bg-[var(--ab-accent-9)] px-3 py-2 text-[13px] font-medium text-[var(--ab-accent-12)] focus:not-sr-only focus:absolute focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Hopp til innholdet
        </a>
        <PreviewBanner />
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Roy state="idle" size={30} />
            <div>
              <p className="text-sm font-medium text-foreground">AB Marketing — Kundeportal</p>
              <p className="text-xs text-muted-foreground">{account.organisation}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{account.contactName}</span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Logg ut">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main id="hovedinnhold" tabIndex={-1} className="flex flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-8">
          {children}
        </main>
      </div>
    </CustomerSessionProvider>
  );
}

export default function KundeLayout({ children }: { children: React.ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
