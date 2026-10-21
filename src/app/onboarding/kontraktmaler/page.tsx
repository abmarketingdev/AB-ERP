"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BellRing, Check, FilePlus2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProposeTemplate, useTemplateAction, useTemplateMappings } from "@/lib/api/onboarding";
import { errorMessage } from "@/lib/api/client";
import { useAccess } from "@/lib/use-access";
import { IS_MOCK } from "@/lib/data-source";
import { CONTRACT_KIND_LABEL, POSITION_LEVEL_LABEL, type TemplateMapping } from "@/types/approval";

/**
 * ONB-04 — «Kontraktmalene er koblet til IDer i signeringsløsningen (Scrive). Endringer
 * i kontraktene skal meldes til Dana før de tas i bruk, slik at onboarding og offboarding
 * fortsetter å virke.»
 *
 * The register lives in HR (it is what HR sends from). A change is a new version that
 * goes Utkast → Varslet (Dana gets e-mail + Slack) → Kvittert → Aktiv, and HR refuses to
 * activate it before the acknowledgement. The page states that order and shows where each
 * change is in it, so nobody has to remember the rule.
 */

const stampFmt = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" });

const STATUS: Record<TemplateMapping["status"], { label: string; tone: string }> = {
  draft: { label: "Utkast", tone: "bg-muted text-muted-foreground" },
  notified: { label: "Varslet Dana", tone: "bg-warning/10 text-warning-on-tint" },
  acknowledged: { label: "Kvittert", tone: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-11)]" },
  active: { label: "Aktiv", tone: "bg-success/10 text-success" },
  retired: { label: "Utgått", tone: "bg-muted text-muted-foreground" },
};

const CAMPAIGN_LABEL: Record<string, string> = {
  "": "Alle", nf: "Norsk Folkehjelp", nrc: "Flyktninghjelpen", strom: "Strømmestiftelsen", kf: "Kreftforeningen",
  care: "CARE", nffh: "Nasjonalforeningen", blakors: "Blå Kors",
};

function slot(t: Pick<TemplateMapping, "kind" | "campaignSlug" | "level">) {
  return [CONTRACT_KIND_LABEL[t.kind] ?? t.kind, CAMPAIGN_LABEL[t.campaignSlug] ?? t.campaignSlug,
          t.level ? POSITION_LEVEL_LABEL[t.level] ?? t.level : "Junior"].join(" · ");
}

export default function Kontraktmaler() {
  const templates = useTemplateMappings();
  const act = useTemplateAction();
  const { can } = useAccess();
  const mayEdit = IS_MOCK || can("onboarding.templates");
  const [error, setError] = React.useState<string | null>(null);

  const rows = templates.data ?? [];
  const pending = rows.filter((r) => r.status === "notified" || r.status === "acknowledged" || r.status === "draft");
  const active = rows.filter((r) => r.status === "active");

  async function run(id: string, action: "acknowledge" | "activate") {
    setError(null);
    try { await act.mutateAsync({ id, action }); } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <PermissionGate permission="onboarding.view">
      <div className="flex flex-1 flex-col gap-6">
        <Link href="/onboarding" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-4" aria-hidden /> Tilbake til onboarding
        </Link>
        <PageHeader
          title="Kontraktmaler"
          description="Hvilken Scrive-mal HR sender for hver kontrakttype, kampanje og nivå"
          source="HR-systemet"
          lastUpdated={templates.dataUpdatedAt ? new Date(templates.dataUpdatedAt) : new Date()}
        />

        <ol className="grid gap-2 text-[13px] text-muted-foreground sm:grid-cols-4" aria-label="Slik endres en mal">
          {[
            { icon: FilePlus2, t: "1. Legg inn ny Scrive-ID" },
            { icon: BellRing, t: "2. Dana varsles automatisk" },
            { icon: ShieldCheck, t: "3. Dana kvitterer" },
            { icon: Check, t: "4. Malen tas i bruk" },
          ].map(({ icon: Icon, t }) => (
            <li key={t} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Icon className="size-4 shrink-0" aria-hidden /> {t}
            </li>
          ))}
        </ol>

        {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <QueryBoundary query={templates} skeleton={<Skeleton className="h-80 w-full rounded-lg" />}
          isEmpty={(d) => d.length === 0} emptyTitle="Ingen maler registrert"
          emptyDescription="Registeret fylles fra HR. Kontakt HR hvis listen er tom." className="flex flex-col gap-6">
          {() => (
            <>
              {pending.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium">Endringer som venter</h2>
                  <ul className="flex flex-col gap-2">
                    {pending.map((r) => (
                      <li key={r.id}>
                        <Card>
                          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{slot(r)}</p>
                              <p className="text-xs text-muted-foreground">
                                Ny Scrive-ID <span className="font-mono">{r.templateId}</span> · versjon {r.version}
                                {r.notifiedAt && ` · varslet ${stampFmt.format(new Date(r.notifiedAt))}`}
                                {r.acknowledgedAt && ` · kvittert av ${r.acknowledgedByName}`}
                              </p>
                              {r.note && <p className="mt-1 text-xs">{r.note}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                              {r.status === "notified" && (
                                <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => run(r.id, "acknowledge")}>
                                  Kvitter som lest
                                </Button>
                              )}
                              {r.status === "acknowledged" && mayEdit && (
                                <Button size="sm" disabled={act.isPending} onClick={() => run(r.id, "activate")}>Ta i bruk</Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">I bruk nå</h2>
                {/* Desktop: a table. Phone: one card per template (08-DESIGN-REVIEW «tables become cards»). */}
                <Card className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kontrakt</TableHead>
                        <TableHead>Kampanje</TableHead>
                        <TableHead>Nivå</TableHead>
                        <TableHead>Scrive-ID</TableHead>
                        <TableHead className="text-right">Versjon</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {active.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{CONTRACT_KIND_LABEL[r.kind] ?? r.kind}</TableCell>
                          <TableCell>{CAMPAIGN_LABEL[r.campaignSlug] ?? r.campaignSlug}</TableCell>
                          <TableCell>{r.level ? POSITION_LEVEL_LABEL[r.level] ?? r.level : "Junior"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.templateId}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.version}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                <ul className="flex flex-col gap-2 sm:hidden">
                  {active.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border px-3 py-2.5">
                      <p className="text-sm">{slot(r)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{r.templateId} · v{r.version}</p>
                    </li>
                  ))}
                </ul>
              </section>

              {mayEdit && <ProposeChange />}
            </>
          )}
        </QueryBoundary>
      </div>
    </PermissionGate>
  );
}

function ProposeChange() {
  const propose = useProposeTemplate();
  const [kind, setKind] = React.useState("ansettelse");
  const [campaignSlug, setCampaign] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6,30}$/.test(templateId.trim())) { setError("Scrive-ID er et tall (se malen i Scrive)."); return; }
    try {
      await propose.mutateAsync({ kind, campaignSlug, level, templateId: templateId.trim(), note: note.trim() });
      setTemplateId(""); setNote(""); setSent(true);
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div>
            <h2 className="text-sm font-medium">Meld en endring</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Endringen sendes til Dana og tas ikke i bruk før hun har kvittert.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-kind">Kontrakt</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="tpl-kind"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONTRACT_KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-camp">Kampanje</Label>
              <Select value={campaignSlug || "_"} onValueChange={(v) => setCampaign(v === "_" ? "" : v)}>
                <SelectTrigger id="tpl-camp"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CAMPAIGN_LABEL).map(([k, v]) => <SelectItem key={k || "_"} value={k || "_"}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-level">Nivå</Label>
              <Select value={level || "_"} onValueChange={(v) => setLevel(v === "_" ? "" : v)}>
                <SelectTrigger id="tpl-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Junior</SelectItem>
                  {Object.entries(POSITION_LEVEL_LABEL).filter(([k]) => k !== "junior").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor="tpl-id">Ny Scrive-ID <span aria-hidden className="text-danger">*</span></Label>
              <Input id="tpl-id" inputMode="numeric" className="font-mono" value={templateId}
                aria-invalid={!!error} onChange={(e) => setTemplateId(e.target.value.replace(/\s/g, ""))} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="tpl-note">Hva er endret</Label>
              <Textarea id="tpl-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {sent && !error && <p role="status" className="text-sm text-success">Endringen er sendt til Dana.</p>}
          <div>
            <Button type="submit" disabled={propose.isPending} className="gap-1.5">
              <BellRing className="size-4" aria-hidden /> {propose.isPending ? "Sender…" : "Send til Dana"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
