"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, ArrowRight, Target, Users2, UserSearch, Building2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CUSTOMER_DEMO_ACCOUNTS } from "@/lib/customer-session";
import { startPreview } from "@/lib/preview";
import { logAudit } from "@/lib/audit";

const ROLE_OPTIONS = [
  { key: "promoter", label: "Promoter", desc: "Kari Nordmann — daglig promoterflate", icon: Target, href: "/promoter" },
  { key: "leader", label: "Team lead", desc: "Ola Nordmann — ett team, egne resultater og oppfølging", icon: Users2, href: "/leder" },
  { key: "saleschief", label: "Salgssjef", desc: "Marte Solberg — alle team i regionen", icon: Building2, href: "/leder/team" },
  { key: "recruitment", label: "Rekrutterer", desc: "Fredrik Amundsen — kandidater og pipeline", icon: UserSearch, href: "/rekruttering" },
] as const;

export default function AdminForhandsvis() {
  const now = new Date();
  const router = useRouter();

  function preview(type: "role" | "customer", key: string, label: string, href: string) {
    startPreview({ type, key, label });
    logAudit({
      actor: "Admin Bruker",
      action: "Startet forhåndsvisning",
      area: "Forhåndsvis som",
      affected: label,
      at: new Date().toLocaleString("nb-NO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    });
    router.push(href);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Forhåndsvis som"
        description="Se plattformen som en valgt rolle eller kundekonto — uten å logge inn som dem"
        source="Tilgangsstyring"
        lastUpdated={now}
      />

      <div className="rounded-md bg-[var(--ab-accent-3)]/40 px-3 py-2 text-sm text-[var(--ab-accent-12)]">
        En tydelig banner vises gjennom hele forhåndsvisningen med en «Avslutt»-knapp. Sesjonen logges i revisjonsloggen — start og slutt.
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Roller</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_OPTIONS.map((r) => {
            const Icon = r.icon;
            return (
              <Card key={r.key}>
                <CardContent className="flex flex-col gap-3 py-4">
                  <span className="flex size-9 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => preview("role", r.key, r.label, r.href)}>
                    <Eye className="size-4" /> Forhåndsvis <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Kundekontoer</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CUSTOMER_DEMO_ACCOUNTS.map((a) => (
            <Card key={a.email}>
              <CardContent className="flex flex-col gap-3 py-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]">
                  <Building2 className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{a.organisation}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.contactName} — {a.email}</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => preview("customer", a.email, `${a.organisation} (kunde)`, "/kunde/rapport")}
                >
                  <Eye className="size-4" /> Forhåndsvis <ArrowRight className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
