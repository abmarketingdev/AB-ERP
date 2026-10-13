"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Check, AlertTriangle, Bot, User } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTasks, useCompleteTask, useCreateTask } from "@/lib/api/srs";
import { useSession } from "@/lib/permissions";
import { errorMessage } from "@/lib/api/client";
import { TASK_STATUS_LABEL, type LeaderTask } from "@/types/task";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * OPPG-01 — den obligatoriske oppgavelisten, med svarfelt per oppgave.
 *
 * The response field is not a comment box: OPPG-01 says "Hver oppgave har
 * svarfelt, som i Asana", and completing without one is refused. A task closed
 * with no answer tells the admin view that the work happened while recording
 * nothing about what happened — which is how a compliance measure becomes a
 * clicking exercise.
 *
 * System tasks and the leader's own are visually distinguished because only the
 * first kind counts towards OPPG-02.
 */

const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
const DEMO_TODAY = "2026-08-20";

function LederoppgaverPage() {
  const session = useSession();
  const leader = session?.role === "Salgssjef" ? "Ola Nordmann" : (session?.name ?? "Ola Nordmann");
  const tasks = useTasks(leader);
  const create = useCreateTask();

  const [newOpen, setNewOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", detail: "", dueDate: "" });
  const [error, setError] = React.useState<string | null>(null);

  const all = tasks.data ?? [];
  const open = all.filter((t) => t.status === "apen");
  const overdue = all.filter((t) => t.status === "forfalt");
  const done = all.filter((t) => t.status === "fullfort");

  async function submitNew() {
    setError(null);
    if (!form.title.trim() || !form.dueDate) { setError("Tittel og frist må fylles ut."); return; }
    try {
      await create.mutateAsync({ ...form, leader });
      setNewOpen(false);
      setForm({ title: "", detail: "", dueDate: "" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Mine oppgaver"
        description={`${open.length} åpne · ${overdue.length} forfalte`}
        source="Systemgenererte og egne oppgaver"
        lastUpdated={new Date()}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> Ny oppgave
          </Button>
        }
      />

      <QueryBoundary
        query={tasks}
        skeleton={<div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen oppgaver"
        emptyDescription="Systemet lager oppgaver når noe venter på deg."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            <Group title="Forfalt" items={overdue} />
            <Group title="Åpne" items={open} />
            <Group title="Fullført" items={done} />
          </>
        )}
      </QueryBoundary>

      <Dialog open={newOpen} onOpenChange={(o) => !o && setNewOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny oppgave</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tk-title">Tittel</Label>
              <Input id="tk-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tk-detail">Beskrivelse</Label>
              <Textarea id="tk-detail" rows={2} value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tk-due">Frist</Label>
              <Input id="tk-due" type="date" className="w-[11rem]" value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Avbryt</Button>
            <Button disabled={create.isPending} onClick={submitNew}>Opprett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Group({ title, items }: { title: string; items: LeaderTask[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((t) => <li key={t.id}><TaskCard task={t} /></li>)}
      </ul>
    </section>
  );
}

function TaskCard({ task: t }: { task: LeaderTask }) {
  const complete = useCompleteTask();
  const [open, setOpen] = React.useState(false);
  const [response, setResponse] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const late = t.status === "forfalt";

  async function submit() {
    setError(null);
    if (!response.trim()) { setError("Skriv et svar før du fullfører."); return; }
    try {
      await complete.mutateAsync({ id: t.id, response: response.trim() });
      setOpen(false);
      setResponse("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className={late ? "border-danger/40" : undefined}>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.title}</span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {t.source === "system" ? <Bot className="size-2.5" aria-hidden /> : <User className="size-2.5" aria-hidden />}
                {t.source === "system" ? "fra systemet" : "egen"}
              </Badge>
              <Badge className={
                t.status === "fullfort" ? "bg-success/10 text-success"
                  : late ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"
              }>
                {TASK_STATUS_LABEL[t.status]}
              </Badge>
            </div>
            {t.detail && <p className="mt-1 text-sm text-muted-foreground">{t.detail}</p>}
            <p className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
              {late && <AlertTriangle className="size-3 text-danger" aria-hidden />}
              Frist {dayFmt.format(new Date(t.dueDate))}
              {t.dueDate < DEMO_TODAY && t.status !== "fullfort" && " — gikk ut"}
            </p>
          </div>
          {t.status !== "fullfort" && !open && (
            <Button size="sm" variant={late ? "default" : "outline"} onClick={() => setOpen(true)}>Svar og fullfør</Button>
          )}
        </div>

        {t.relatedCandidateId && (
          <Link
            href={`/rekruttering/kandidater/${t.relatedCandidateId}`}
            className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Åpne kandidaten
          </Link>
        )}

        {t.response && (
          <p className="rounded-lg bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Svar: </span>{t.response}
          </p>
        )}

        {open && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`rsp-${t.id}`}>Svar</Label>
              <Textarea id={`rsp-${t.id}`} rows={3} value={response} onChange={(e) => setResponse(e.target.value)}
                placeholder="Hva gjorde du?" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" disabled={complete.isPending} onClick={submit}>
                <Check className="size-4" /> Fullfør
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null); }}>Avbryt</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Lederoppgaver() {
  return (
    <PermissionGate permission="tasks.view">
      <LederoppgaverPage />
    </PermissionGate>
  );
}
