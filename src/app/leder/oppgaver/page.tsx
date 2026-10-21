"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Check, AlertTriangle, Bot, User, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { DatePicker } from "@/components/patterns/date-picker";
import { useMascotOnDone } from "@/lib/use-mascot";
import { Mascot } from "@/components/patterns/mascot";
import { ResponseFieldForm, ResponseSummary } from "@/components/patterns/response-field-form";
import { useTasks, useCompleteTask, useCreateTask } from "@/lib/api/tasks";
import { ApiError, errorMessage } from "@/lib/api/client";
import { TASK_STATUS_LABEL, type LeaderTask } from "@/types/task";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * OPPG-01 — den obligatoriske oppgavelisten, med svarfelt per oppgave.
 *
 * The response field is not a comment box: OPPG-01 says "Hver oppgave har
 * svarfelt, som i Asana", so each task carries its own fields (yes/no, text,
 * number, choice, date) and completing without the required ones is refused —
 * by the server, which shows its reasons inline here. A task closed with no
 * answer tells the admin view that the work happened while recording nothing
 * about what happened.
 *
 * Whose list this is, is the server's decision (the token), never a name this
 * page sends. «Forfalt» is derived by the server from the deadline.
 *
 * Some system tasks can only be closed by the action they ask for: the data Ole
 * needs (GODK-01) is a form in Godkjenning, and a free-text answer cannot stand
 * in for it — those link to the form instead of offering «Svar og fullfør».
 */

const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function LederoppgaverPage() {
  const tasks = useTasks();
  const create = useCreateTask();

  const [newOpen, setNewOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", detail: "", dueAt: "" });
  const [error, setError] = React.useState<string | null>(null);

  const all = (tasks.data ?? []).filter((t) => t.status !== "kansellert");
  const overdue = all.filter((t) => t.overdue);
  const open = all.filter((t) => t.status === "apen" && !t.overdue);
  const done = all.filter((t) => t.status === "fullfort");

  async function submitNew() {
    setError(null);
    if (form.title.trim().length < 3 || !form.dueAt) { setError("Tittel og frist må fylles ut."); return; }
    try {
      await create.mutateAsync({ title: form.title.trim(), detail: form.detail, dueAt: new Date(form.dueAt).toISOString() });
      setNewOpen(false);
      setForm({ title: "", detail: "", dueAt: "" });
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
        lastUpdated={tasks.dataUpdatedAt ? new Date(tasks.dataUpdatedAt) : new Date()}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> Ny oppgave
          </Button>
        }
      />

      <QueryBoundary
        query={tasks}
        skeleton={<div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.filter((t) => t.status !== "kansellert").length === 0}
        emptyTitle="Ingen oppgaver"
        emptyDescription="Systemet lager oppgaver når noe venter på deg — for eksempel å registrere oppmøte etter et intervju."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            <AllDone done={overdue.length === 0 && open.length === 0 && done.length > 0} count={done.length} />
            <Group title="Forfalt" items={overdue} />
            <Group title="Åpne" items={open} />
            <Group title="Fullført" items={done} />
          </>
        )}
      </QueryBoundary>

      <ResponsiveSheet open={newOpen} onOpenChange={(o) => !o && setNewOpen(false)} title="Ny oppgave"
        footer={<>
          <Button variant="ghost" onClick={() => setNewOpen(false)}>Avbryt</Button>
          <Button disabled={create.isPending || form.title.trim().length < 3 || !form.dueAt} onClick={submitNew}>Opprett oppgave</Button>
        </>}>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tk-title">Tittel</Label>
            <Input id="tk-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tk-detail">Beskrivelse <span className="text-muted-foreground">(valgfritt)</span></Label>
            <Textarea id="tk-detail" rows={2} value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tk-due">Frist</Label>
            <DatePicker id="tk-due" withTime value={form.dueAt} min={new Date().toLocaleDateString("sv-SE")}
              onChange={(v) => setForm((f) => ({ ...f, dueAt: v }))} />
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        </div>
      </ResponsiveSheet>
    </div>
  );
}

/** Pandi «once» when the last open task is closed — not on a visit where all was already done. */
function AllDone({ done, count }: { done: boolean; count: number }) {
  const { key, ...mascot } = useMascotOnDone(done);
  if (!done) return null;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <Mascot key={key} {...mascot} size={56} label="Alle oppgaver er fullført" />
        <div>
          <p className="font-medium">Alle oppgaver er fullført</p>
          <p className="text-sm text-muted-foreground">{count} fullført. Nye kommer når systemet trenger deg.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Group({ title, items }: { title: string; items: LeaderTask[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-sm font-medium text-muted-foreground">{title} · {items.length}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((t) => <li key={t.id}><TaskCard task={t} /></li>)}
      </ul>
    </section>
  );
}

function TaskCard({ task: t }: { task: LeaderTask }) {
  const complete = useCompleteTask();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const formUrl = typeof t.payload?.formUrl === "string" ? t.payload.formUrl : null;
  // The primary action waits for the required fields (08-DESIGN-REVIEW §5); the server re-checks.
  const fields = t.responseSchema.length ? t.responseSchema : [{ key: "svar", required: true }];
  const requiredDone = fields.filter((f) => f.required).every((f) => {
    const v = values[f.key];
    return v !== undefined && v !== null && !(typeof v === "string" && !v.trim());
  });

  async function submit() {
    setError(null);
    setErrors({});
    try {
      await complete.mutateAsync({ id: t.id, response: values });
      setOpen(false);
      setValues({});
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { errors?: Record<string, string> }) : null;
      if (body?.errors) setErrors(body.errors);
      setError(errorMessage(err));
    }
  }

  return (
    <Card className={t.overdue ? "border-danger/40" : undefined}>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.title}{t.subject && !t.title.includes(t.subject) && <span className="font-normal text-muted-foreground"> — {t.subject}</span>}</span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {t.source === "system" ? <Bot className="size-2.5" aria-hidden /> : <User className="size-2.5" aria-hidden />}
                {t.source === "system" ? "fra systemet" : "egen"}
              </Badge>
              <Badge className={
                t.status === "fullfort" ? "bg-success/10 text-success"
                  : t.overdue ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"
              }>
                {t.overdue ? TASK_STATUS_LABEL.forfalt : TASK_STATUS_LABEL[t.status]}
              </Badge>
            </div>
            {t.detail && <p className="mt-1 text-sm text-muted-foreground">{t.detail}</p>}
            <p className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
              {t.overdue && <AlertTriangle className="size-3 text-danger" aria-hidden />}
              Frist {dayFmt.format(new Date(t.dueAt))}{t.overdue && " — gikk ut"}
            </p>
          </div>
          {t.status === "apen" && !open && (t.answerable ? (
            <Button size="sm" variant={t.overdue ? "default" : "outline"} className="min-h-10" onClick={() => setOpen(true)}>
              Svar og fullfør
            </Button>
          ) : formUrl ? (
            <Button asChild size="sm" variant={t.overdue ? "default" : "outline"} className="min-h-10 gap-1.5">
              <Link href={formUrl}><ExternalLink className="size-3.5" aria-hidden /> Åpne skjemaet</Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Lukkes når handlingen er gjort</span>
          ))}
        </div>

        {t.relatedCandidateId && (
          <Link
            href={`/rekruttering/kandidater/${t.relatedCandidateId}`}
            className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Åpne kandidaten
          </Link>
        )}

        {t.response && t.response.length > 0 && <ResponseSummary fields={t.responseSchema} response={t.response} />}

        {open && (
          <div className="flex flex-col gap-3">
            <ResponseFieldForm idPrefix={`rsp-${t.id}`} fields={t.responseSchema} values={values} errors={errors}
              onChange={(k, v) => setValues((cur) => ({ ...cur, [k]: v }))} />
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" className="min-h-10 gap-1.5" disabled={complete.isPending || !requiredDone} onClick={submit}>
                <Check className="size-4" /> Fullfør
              </Button>
              <Button size="sm" variant="ghost" className="min-h-10" onClick={() => { setOpen(false); setError(null); setErrors({}); }}>
                Avbryt
              </Button>
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
