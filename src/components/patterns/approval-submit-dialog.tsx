"use client";

import * as React from "react";
import { Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovalFormOptions, useSubmitApproval } from "@/lib/api/approval";
import { ApiError, errorMessage } from "@/lib/api/client";
import { approvalSubmitSchema, type ApprovalRequest } from "@/types/approval";
import { cn } from "@/lib/utils";

/**
 * GODK-01 — «Leder sender kandidat til godkjenning etter intervju. Med data som
 * inkluderer: e-post, kontrakt, oppstartsdato, team, prosjekt, junior eller senior,
 * hvilke dager de skal jobbe, stillingsprosent og student eller ikke.»
 *
 * Every one of the nine is required and typed, because this is what HR receives to
 * send the contract (ONB-01/02) — a free-text line cannot be handed over. The board
 * (A2) opens this when a card is dropped on «Til godkjenning»; the candidate page
 * opens it from «Send til godkjenning». The server validates the same rules and
 * only offers levels that have a Scrive template for the chosen project.
 */
export interface ApprovalSubmitDialogProps {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (req: ApprovalRequest) => void;
}

type FieldErrors = Partial<Record<string, string>>;

export function ApprovalSubmitDialog({ candidateId, open, onOpenChange, onSubmitted }: ApprovalSubmitDialogProps) {
  const [campaignId, setCampaignId] = React.useState("");
  const options = useApprovalFormOptions(open ? candidateId : undefined, campaignId);
  const submit = useSubmitApproval();

  const [email, setEmail] = React.useState("");
  const [kinds, setKinds] = React.useState<string[]>(["ansettelse", "prosjekt"]);
  const [startDate, setStartDate] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [level, setLevel] = React.useState("junior");
  const [showLeader, setShowLeader] = React.useState(false);
  const [days, setDays] = React.useState<number[]>([]);
  const [percentage, setPercentage] = React.useState("");
  const [student, setStudent] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  // Prefill once per open from the candidate (e-post, prosjekt) — the leader confirms it.
  const prefilled = React.useRef(false);
  React.useEffect(() => {
    if (!open) { prefilled.current = false; return; }
    const p = options.data?.prefill;
    if (p && !prefilled.current) {
      prefilled.current = true;
      if (p.email) setEmail(p.email);
      if (p.campaignId) setCampaignId(p.campaignId);
      if (options.data && options.data.teams.length === 1) setTeamId(options.data.teams[0].id);
    }
  }, [open, options.data]);

  const levels = options.data?.levels ?? [];
  const juniorSenior = levels.filter((l) => !l.leader);
  const leaderLevels = levels.filter((l) => l.leader);
  const chosenLevel = levels.find((l) => l.key === level);

  function toggle<T>(list: T[], v: T) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function send() {
    setFormError(null);
    const parsed = approvalSubmitSchema.safeParse({
      candidateId, email, contractKinds: kinds, startDate, teamId, campaignId, positionLevel: level,
      workDays: [...days].sort(), positionPercentage: percentage, isStudent: student ?? undefined, note,
    });
    if (!parsed.success) {
      const e: FieldErrors = {};
      for (const issue of parsed.error.issues) e[String(issue.path[0])] ??= issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    try {
      const req = await submit.mutateAsync(parsed.data);
      onSubmitted?.(req);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === "object" && "errors" in err.body) {
        const server = (err.body as { errors: Record<string, string[]> }).errors;
        setErrors(Object.fromEntries(Object.entries(server).map(([k, v]) => [k, v[0]])));
      }
      setFormError(errorMessage(err));
    }
  }

  const err = (k: string) => errors[k] ? <p id={`${k}-err`} className="text-xs text-danger">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send til godkjenning</DialogTitle>
          <DialogDescription>
            Ole får varsel og godkjenner eller avviser. Det du fyller inn her, er det HR bruker til kontrakten.
          </DialogDescription>
        </DialogHeader>

        {options.isLoading ? (
          <div className="flex flex-col gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : options.isError ? (
          <p className="text-sm text-danger">Kunne ikke hente skjemavalg. Prøv igjen.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="g-email">E-post</Label>
              <Input id="g-email" type="email" autoComplete="off" value={email} aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-err" : undefined} onChange={(e) => setEmail(e.target.value)} />
              {err("email")}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-campaign">Prosjekt</Label>
              <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setLevel("junior"); }}>
                <SelectTrigger id="g-campaign" aria-invalid={!!errors.campaignId}><SelectValue placeholder="Velg prosjekt" /></SelectTrigger>
                <SelectContent>
                  {options.data?.campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {err("campaignId")}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-team">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger id="g-team" aria-invalid={!!errors.teamId}><SelectValue placeholder="Velg team" /></SelectTrigger>
                <SelectContent>
                  {options.data?.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {err("teamId")}
            </div>

            <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">Junior eller senior</legend>
              <div className="flex flex-wrap gap-2">
                {(showLeader ? levels : juniorSenior).map((l) => (
                  <Button key={l.key} type="button" size="sm" variant={level === l.key ? "default" : "outline"}
                    aria-pressed={level === l.key} onClick={() => setLevel(l.key)}>
                    {l.label}
                  </Button>
                ))}
                {leaderLevels.length > 0 && !showLeader && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowLeader(true)}>Vis ledernivåer</Button>
                )}
              </div>
              {!campaignId && <p className="text-xs text-muted-foreground">Velg prosjekt for å se nivåene som har kontraktmal.</p>}
              {chosenLevel?.manualAccount && (
                <p className="text-xs text-warning-on-tint">
                  Ledernivå: brukerkontoen opprettes manuelt i HR (én konto, én rolle).
                </p>
              )}
              {err("positionLevel")}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-start">Oppstartsdato</Label>
              <Input id="g-start" type="date" value={startDate} aria-invalid={!!errors.startDate}
                onChange={(e) => setStartDate(e.target.value)} />
              {err("startDate")}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-pct">Stillingsprosent</Label>
              <div className="flex items-center gap-2">
                <Input id="g-pct" inputMode="numeric" className="tabular-nums" value={percentage}
                  aria-invalid={!!errors.positionPercentage} onChange={(e) => setPercentage(e.target.value.replace(/[^\d]/g, ""))} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {err("positionPercentage")}
            </div>

            <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">Hvilke dager skal personen jobbe</legend>
              <div className="flex flex-wrap gap-1.5">
                {(options.data?.weekdays ?? []).map((d) => (
                  <Button key={d.key} type="button" size="sm" className="min-w-11"
                    variant={days.includes(d.key) ? "default" : "outline"} aria-pressed={days.includes(d.key)}
                    onClick={() => setDays(toggle(days, d.key))}>
                    {d.label.slice(0, 3)}
                  </Button>
                ))}
              </div>
              {err("workDays")}
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Student</legend>
              <div className="flex gap-2">
                {[{ v: true, l: "Ja" }, { v: false, l: "Nei" }].map((o) => (
                  <Button key={o.l} type="button" size="sm" variant={student === o.v ? "default" : "outline"}
                    aria-pressed={student === o.v} onClick={() => setStudent(o.v)}>{o.l}</Button>
                ))}
              </div>
              {err("isStudent")}
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Kontrakt</legend>
              {(options.data?.contractKinds ?? []).map((k) => (
                <label key={k.key} className={cn("flex items-center gap-2 text-sm", k.key === "ansettelse" && "text-muted-foreground")}>
                  <Checkbox checked={kinds.includes(k.key)} disabled={k.key === "ansettelse"}
                    onCheckedChange={() => setKinds(toggle(kinds, k.key))} />
                  {k.label}
                </label>
              ))}
              {err("contractKinds")}
            </fieldset>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="g-note">Notat til Ole <span className="text-muted-foreground">(valgfritt)</span></Label>
              <Textarea id="g-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}

        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button className="gap-1.5" disabled={submit.isPending || options.isLoading} onClick={send}>
            <Send className="size-4" aria-hidden /> Send til Ole
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
