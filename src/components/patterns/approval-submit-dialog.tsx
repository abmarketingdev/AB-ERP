"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { DateField } from "@/components/patterns/date-field";
import { FormErrorSummary, errorsFromApi, type FieldError } from "@/components/patterns/form-error-summary";
import { useApprovalFormOptions, useSubmitApproval } from "@/lib/api/approval";
import { ApiError, errorMessage } from "@/lib/api/client";
import { approvalSubmitSchema, type ApprovalFormOptions, type ApprovalRequest } from "@/types/approval";
import { cn } from "@/lib/utils";

/**
 * GODK-01 — «Leder sender kandidat til godkjenning etter intervju. Med data som
 * inkluderer: e-post, kontrakt, oppstartsdato, team, prosjekt, junior eller senior,
 * hvilke dager de skal jobbe, stillingsprosent og student eller ikke.»
 *
 * Every one of the nine is required and typed, because this is what HR receives to
 * send the contract (ONB-01/02) — a free-text line cannot be handed over. The board
 * (A2) opens this when a card is dropped on «Til godkjenning»; the candidate page
 * opens it from «Send til godkjenning». The server validates the same rules and only
 * offers levels that have a Scrive template for the chosen project.
 *
 * A dialog on desktop and a bottom sheet on a phone (leaders fill it in after the
 * interview, often standing up).
 */
export interface ApprovalSubmitDialogProps {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (req: ApprovalRequest) => void;
}

const FORM_ID = "godk-form";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ApprovalSubmitDialog({ candidateId, open, onOpenChange, onSubmitted }: ApprovalSubmitDialogProps) {
  const base = useApprovalFormOptions(open ? candidateId : undefined);
  const submit = useSubmitApproval();
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Send til godkjenning"
      description="Ole får varsel og godkjenner eller avviser. Det du fyller inn her, er det HR bruker til kontrakten."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button type="submit" form={FORM_ID} className="gap-1.5" disabled={submit.isPending || !base.data}>
            <Send className="size-4" aria-hidden /> {submit.isPending ? "Sender…" : "Send til Ole"}
          </Button>
        </>
      }
    >
      {base.isLoading ? (
        <div className="flex flex-col gap-3 pt-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : base.isError || !base.data ? (
        <p role="alert" className="pt-2 text-sm text-danger">Kunne ikke hente skjemavalg. Lukk og prøv igjen.</p>
      ) : (
        // Mounted once the options are known, so the prefill is the form's initial state.
        <ApprovalForm key={candidateId} candidateId={candidateId} base={base.data} submit={submit}
          onDone={(req) => { onSubmitted?.(req); onOpenChange(false); }} />
      )}
    </ResponsiveSheet>
  );
}

function ApprovalForm({ candidateId, base, submit, onDone }: {
  candidateId: string;
  base: ApprovalFormOptions;
  submit: ReturnType<typeof useSubmitApproval>;
  onDone: (req: ApprovalRequest) => void;
}) {
  const [campaignId, setCampaignId] = React.useState(base.prefill.campaignId ?? "");
  const perCampaign = useApprovalFormOptions(candidateId, campaignId || undefined);
  const levels = (campaignId ? perCampaign.data?.levels : undefined) ?? base.levels;

  const [email, setEmail] = React.useState(base.prefill.email ?? "");
  const [kinds, setKinds] = React.useState<string[]>(["ansettelse", "prosjekt"]);
  const [startDate, setStartDate] = React.useState("");
  const [teamId, setTeamId] = React.useState(base.teams.length === 1 ? base.teams[0].id : "");
  const [level, setLevel] = React.useState("junior");
  const [showLeader, setShowLeader] = React.useState(false);
  const [days, setDays] = React.useState<number[]>([]);
  const [percentage, setPercentage] = React.useState("");
  const [student, setStudent] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);

  const juniorSenior = levels.filter((l) => !l.leader);
  const leaderLevels = levels.filter((l) => l.leader);
  const chosenLevel = levels.find((l) => l.key === level);
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;

  function toggle<T>(list: T[], v: T) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = approvalSubmitSchema.safeParse({
      candidateId, email, contractKinds: kinds, startDate, teamId, campaignId, positionLevel: level,
      workDays: [...days].sort((a, b) => a - b), positionPercentage: percentage, isStudent: student ?? undefined, note,
    });
    if (!parsed.success) {
      const seen = new Set<string>();
      setErrors(parsed.error.issues.flatMap((issue) => {
        const field = String(issue.path[0]);
        if (seen.has(field)) return [];
        seen.add(field);
        return [{ field, message: issue.message }];
      }));
      return;
    }
    setErrors([]);
    try {
      onDone(await submit.mutateAsync(parsed.data));
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? errorsFromApi(err.body).filter((x) => x.field) : [];
      if (fieldErrors.length) setErrors(fieldErrors);
      else setFormError(errorMessage(err));
    }
  }

  const fieldError = (field: string) => errorFor(field)
    ? <p id={`${field}-error`} className="text-xs text-danger">{errorFor(field)}</p> : null;
  const aria = (field: string) => ({ "aria-invalid": !!errorFor(field), "aria-describedby": errorFor(field) ? `${field}-error` : undefined });

  return (
    <form id={FORM_ID} noValidate onSubmit={send} className="flex flex-col gap-4 pt-2">
      <FormErrorSummary errors={errors} title="Rett dette før du sender til Ole" />
      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="email">E-post <span aria-hidden className="text-danger">*</span></Label>
          <Input id="email" type="email" autoComplete="off" value={email} {...aria("email")}
            onChange={(e) => setEmail(e.target.value)} />
          {fieldError("email")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaignId">Prosjekt <span aria-hidden className="text-danger">*</span></Label>
          <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setLevel("junior"); }}>
            <SelectTrigger id="campaignId" {...aria("campaignId")}><SelectValue placeholder="Velg prosjekt" /></SelectTrigger>
            <SelectContent>{base.campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {fieldError("campaignId")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="teamId">Team <span aria-hidden className="text-danger">*</span></Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger id="teamId" {...aria("teamId")}><SelectValue placeholder="Velg team" /></SelectTrigger>
            <SelectContent>{base.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          {fieldError("teamId")}
        </div>

        <fieldset id="positionLevel" className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Junior eller senior <span aria-hidden className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-2">
            {(showLeader ? levels : juniorSenior).map((l) => (
              <Button key={l.key} type="button" size="sm" className="min-h-11 sm:min-h-8"
                variant={level === l.key ? "default" : "outline"} aria-pressed={level === l.key} onClick={() => setLevel(l.key)}>
                {l.label}
              </Button>
            ))}
            {leaderLevels.length > 0 && !showLeader && (
              <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setShowLeader(true)}>
                Vis ledernivåer
              </Button>
            )}
          </div>
          {!campaignId && <p className="text-xs text-muted-foreground">Velg prosjekt for å se nivåene som har kontraktmal.</p>}
          {chosenLevel?.manualAccount && (
            <p className="text-xs text-warning-on-tint">Ledernivå: brukerkontoen opprettes manuelt i HR (én konto, én rolle).</p>
          )}
          {fieldError("positionLevel")}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Oppstartsdato <span aria-hidden className="text-danger">*</span></Label>
          <DateField id="startDate" value={startDate} onChange={setStartDate} min={todayIso()}
            invalid={!!errorFor("startDate")} describedBy={errorFor("startDate") ? "startDate-error" : undefined} />
          {fieldError("startDate")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="positionPercentage">Stillingsprosent <span aria-hidden className="text-danger">*</span></Label>
          <div className="flex items-center gap-2">
            <Input id="positionPercentage" inputMode="numeric" className="tabular-nums" value={percentage} {...aria("positionPercentage")}
              onChange={(e) => setPercentage(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          {fieldError("positionPercentage")}
        </div>

        <fieldset id="workDays" className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Hvilke dager skal personen jobbe <span aria-hidden className="text-danger">*</span></legend>
          <div className="grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap">
            {base.weekdays.map((d) => (
              <Button key={d.key} type="button" size="sm" className="min-h-11 px-0 sm:min-h-8 sm:min-w-11 sm:px-3"
                variant={days.includes(d.key) ? "default" : "outline"} aria-pressed={days.includes(d.key)} aria-label={d.label}
                onClick={() => setDays(toggle(days, d.key))}>
                {d.label.slice(0, 3)}
              </Button>
            ))}
          </div>
          {fieldError("workDays")}
        </fieldset>

        <fieldset id="isStudent" className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Student <span aria-hidden className="text-danger">*</span></legend>
          <div className="flex gap-2">
            {[{ v: true, l: "Ja" }, { v: false, l: "Nei" }].map((o) => (
              <Button key={o.l} type="button" size="sm" className="min-h-11 min-w-16 sm:min-h-8"
                variant={student === o.v ? "default" : "outline"} aria-pressed={student === o.v} onClick={() => setStudent(o.v)}>
                {o.l}
              </Button>
            ))}
          </div>
          {fieldError("isStudent")}
        </fieldset>

        <fieldset id="contractKinds" className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Kontrakt <span aria-hidden className="text-danger">*</span></legend>
          {base.contractKinds.map((k) => (
            <label key={k.key} className={cn("flex min-h-8 items-center gap-2 text-sm", k.key === "ansettelse" && "text-muted-foreground")}>
              <Checkbox checked={kinds.includes(k.key)} disabled={k.key === "ansettelse"}
                onCheckedChange={() => setKinds(toggle(kinds, k.key))} />
              {k.label}{k.key === "ansettelse" && " (alltid med)"}
            </label>
          ))}
          {fieldError("contractKinds")}
        </fieldset>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="note">Notat til Ole <span className="text-muted-foreground">(valgfritt)</span></Label>
          <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </form>
  );
}
