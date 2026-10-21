"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft, Check, Camera, Package, FileSignature, Bell, UserX, Lock, ExternalLink, KeyRound,
  CircleDashed, CircleCheck, Eye, Send, RefreshCw, CloudOff,
} from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Mascot } from "@/components/patterns/mascot";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useNewHire, useCheckOnboarding, useRemindContract, useUploadPhoto, useProvisionAccount,
  useCompleteOnboarding, useRetryHandover,
} from "@/lib/api/onboarding";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { CHECKLIST_LABEL, CONTRACT_STATUS_LABEL, type Contract, type NewHire } from "@/types/onboarding";

/**
 * ONB-02 … ONB-09 — the onboarding of one person.
 *
 * The screen is ordered the way the process runs — contract, account, photo,
 * equipment, first day, finish — because it is worked through top to bottom by
 * somebody with the new starter in front of them.
 *
 * HR owns the case. Nothing here pretends otherwise: contracts are sent by HR the
 * moment Ole approves (ONB-02) and signed in Scrive, equipment is handed out in
 * HR's register (ONB-07), attendance is registered in the leader calendar (A5).
 * Every checklist item says where its tick comes from, and only «personalia» is
 * confirmed by hand. The rules are enforced by the server and the refusal is
 * shown with its reason — the first day cannot count before the contract is
 * signed (ONB-03), and the case cannot be finished with an open item (ONB-09).
 */

const dateFmt = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" });
const stampFmt = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" });
const HR_URL = process.env.NEXT_PUBLIC_HR_URL ?? "https://hr.abmarketing.no";

const SOURCE_LABEL: Record<string, string> = {
  personalia: "Fra kontrakten i Scrive, bekreftes av HR",
  kontrakt: "Fra Scrive",
  utstyr: "Fra utstyrsregisteret i HR",
  bilde: "Tas av Ole",
  opplaering: "Fra opplæringen",
  forstedag: "Fra lederkalenderen",
};

const TEMPLATES = [
  { key: "promotor", label: "Promotør" },
  { key: "promotor_pluss", label: "Promotør med ekstra tilgang" },
  { key: "leder", label: "Leder" },
];

const KIND_LABEL: Record<string, string> = {
  ansettelse: "Ansettelseskontrakt", prosjekt: "Prosjektavtale", bil: "Bilavtale", utstyr: "Utstyrsavtale",
};

export default function OnboardingDetail() {
  const { id } = useParams<{ id: string }>();
  const hire = useNewHire(id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link href="/onboarding"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden /> Tilbake til onboarding
      </Link>
      <QueryBoundary query={hire} skeleton={<DetailSkeleton />} className="flex flex-col gap-6">
        {(h) => <Detail hire={h} />}
      </QueryBoundary>
    </div>
  );
}

function Detail({ hire: h }: { hire: NewHire }) {
  const check = useCheckOnboarding();
  const remind = useRemindContract();
  const photo = useUploadPhoto();
  const provision = useProvisionAccount();
  const complete = useCompleteOnboarding();
  const retry = useRetryHandover();
  const reduce = useReducedMotion();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [template, setTemplate] = React.useState(h.manualAccount ? "leder" : "promotor");

  const done = h.checklist.filter((c) => c.done).length;
  const pct = Math.round((done / h.checklist.length) * 100);
  const contracts = h.contracts.length ? h.contracts : [h.contract];
  const allSigned = contracts.every((c) => c.status === "signert");
  const closed = h.status === "completed" || h.status === "no_show" || h.status === "cancelled";

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <>
      <PageHeader
        title={h.name}
        description={`${h.team} · ${h.campaign} · starter ${dateFmt.format(new Date(h.startDate))}`}
        source={`Registrert av ${h.registeredBy}`}
        lastUpdated={h.hrSync?.at ? new Date(h.hrSync.at) : new Date()}
      />

      {/* Partial state: HR is the source; when it cannot be reached we say so instead of guessing. */}
      {h.hrSync?.state === "failed" && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-on-tint">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          Kunne ikke overføre til HR ennå. Systemet prøver igjen automatisk.
          <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={retry.isPending}
            onClick={() => run(() => retry.mutateAsync({ id: h.id }))}>
            <RefreshCw className="size-3.5" aria-hidden /> Prøv nå
          </Button>
        </div>
      )}
      {h.status === "pending_handover" && h.hrSync?.state !== "failed" && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Mascot state="thinking" motion="loop" size={32} label="Overfører til HR" />
          Overføres til HR. Kontrakten sendes til signering så snart HR har tatt imot.
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <AnimatePresence>
        {h.status === "completed" && (
          <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }} role="status"
            className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            <Mascot state="win-big" motion="once" size={44} />
            Onboardingen er fullført. {h.name} er opprettet som ansatt
            {h.accessTemplate ? ` med tilgangsmalen «${TEMPLATES.find((t) => t.key === h.accessTemplate)?.label ?? h.accessTemplate}»` : ""}.
          </motion.div>
        )}
      </AnimatePresence>

      {h.status === "no_show" && (
        <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <UserX className="size-4 shrink-0" aria-hidden /> Møtte ikke første arbeidsdag. Onboardingen er avbrutt.
        </p>
      )}

      {/* ── Checklist (ONB-05) ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Sjekkliste</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{done} av {h.checklist.length} fullført</span>
          </div>
          <Progress value={pct} className="h-1.5" aria-label={`${done} av ${h.checklist.length} fullført`} />
          <ul className="flex flex-col divide-y divide-border">
            {h.checklist.map((c) => (
              <motion.li key={c.key} layout={!reduce} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  {c.manual ? (
                    <Checkbox aria-label={CHECKLIST_LABEL[c.key]} checked={c.done} disabled={check.isPending || closed}
                      onCheckedChange={(v) => run(() => check.mutateAsync({ id: h.id, key: c.key, done: Boolean(v) }))} />
                  ) : c.done ? (
                    <CircleCheck className="size-4 text-success" aria-hidden />
                  ) : (
                    <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex flex-col">
                    <span className={c.done ? "text-muted-foreground" : undefined}>
                      {CHECKLIST_LABEL[c.key]}
                      <span className="sr-only">{c.done ? " — fullført" : " — ikke fullført"}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{SOURCE_LABEL[c.key]}</span>
                  </span>
                </div>
                {c.at && <span className="text-xs tabular-nums text-muted-foreground">{stampFmt.format(new Date(c.at))}</span>}
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── Contracts (ONB-02, ONB-03, ONB-04) ──────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <FileSignature className="size-4 text-muted-foreground" aria-hidden /> Kontrakter
          </h2>
          {contracts.map((c, i) => (
            <ContractTimeline key={c.id ?? i} c={c} disabled={remind.isPending || closed}
              onRemind={() => run(() => remind.mutateAsync({ id: h.id, contractId: c.id }))} />
          ))}
          <p className="text-xs text-muted-foreground">
            Kontrakten sendes automatisk fra HR når Ole godkjenner. Personen kan ikke starte før den er signert.
            Endringer i kontraktmalene meldes til Dana før de tas i bruk
            (<Link href="/onboarding/kontraktmaler" className="underline">kontraktmaler</Link>).
          </p>
        </CardContent>
      </Card>

      {/* ── Account («Opprett brukerkonto», master Q5) ─────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden /> Brukerkonto
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {h.authUserId
                ? "Opprettet. Personen får velkomst-e-post med passordlenke når onboardingen fullføres."
                : h.manualAccount
                  ? "Ledernivå: kontoen opprettes manuelt i HR (én konto, én rolle)."
                  : allSigned ? "Kontraktene er signert. Kontoen kan opprettes." : "Kan opprettes når alle kontraktene er signert."}
            </p>
          </div>
          {h.authUserId ? (
            <Badge className="bg-success/10 text-success">Opprettet</Badge>
          ) : !h.manualAccount ? (
            <Button size="sm" disabled={!allSigned || provision.isPending || closed}
              onClick={() => run(() => provision.mutateAsync({ id: h.id }))}>
              Opprett brukerkonto
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Photo (ONB-06) ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Camera className="size-4 text-muted-foreground" aria-hidden /> Bilde
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {h.photo
                ? `Lagt inn av ${h.photo.uploadedBy}, ${stampFmt.format(new Date(h.photo.uploadedAt))}`
                : h.authUserId ? "Ole tar bildet og kobler det til personen." : "Kan tas når brukerkontoen er opprettet."}
            </p>
          </div>
          {/* `capture` opens the camera on a phone; on a desktop it is an ordinary file picker. */}
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) run(() => photo.mutateAsync({ id: h.id, file }));
            }} />
          <Button size="sm" variant={h.photo ? "ghost" : "outline"} className="gap-1.5"
            disabled={photo.isPending || !h.authUserId || closed} onClick={() => fileRef.current?.click()}>
            {photo.isPending
              ? <><Mascot state="thinking" motion="loop" size={20} label="Laster opp" /> Laster opp</>
              : <><Camera className="size-4" aria-hidden /> {h.photo ? "Ta nytt bilde" : "Ta bilde"}</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Equipment + equipment contract (ONB-07) ─────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Package className="size-4 text-muted-foreground" aria-hidden /> Utstyr
            </h2>
            <a href={`${HR_URL}/varehus`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground">
              Registrer utlevering i HR <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>

          {h.equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingenting utlevert ennå. Utstyr registreres med serienummer i utstyrslisten på hr.abmarketing.no.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Modell</th>
                    <th className="pb-2 font-medium">Serienummer</th>
                    <th className="pb-2 font-medium">Utlevert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {h.equipment.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2">{e.kind}</td>
                      <td className="py-2 text-muted-foreground">{e.model}</td>
                      <td className="py-2 font-mono text-xs">{e.serial || "—"}</td>
                      <td className="py-2 text-xs tabular-nums text-muted-foreground">
                        {e.handedOutAt ? stampFmt.format(new Date(e.handedOutAt)) : "—"}{e.handedOutBy && ` · ${e.handedOutBy}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Utstyrskontrakt</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sendes fra HR etter utlevering, og den ansatte bekrefter mottatt utstyr.
                {h.equipmentContract.signedAt && ` Signert ${stampFmt.format(new Date(h.equipmentContract.signedAt))}.`}
              </p>
            </div>
            <StatusBadge status={h.equipmentContract.status} />
          </div>
        </CardContent>
      </Card>

      {/* ── First day (ONB-08) — registered in the leader calendar (A5) ─── */}
      <Card className={h.status === "no_show" ? "border-danger/40" : undefined}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <UserX className="size-4 text-muted-foreground" aria-hidden /> Første arbeidsdag
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {h.firstDayNoShow
                ? `Registrert som ikke møtt${h.firstDayNoShow.at ? ` ${stampFmt.format(new Date(h.firstDayNoShow.at))}` : ""}, fulgt opp av ${h.firstDayNoShow.followedUpBy}.`
                : `Starter ${dateFmt.format(new Date(h.startDate))}. Lederen registrerer oppmøte i lederkalenderen.`}
            </p>
            {h.blockedReasons.length > 0 && !closed && (
              <p className="mt-1 text-xs text-warning-on-tint">
                Venter på signert kontrakt. Oppmøte kan ikke registreres som møtt før dette er på plass:{" "}
                {h.blockedReasons.map((r) => r.label).join(" ")}
              </p>
            )}
          </div>
          <Link href="/leder/oppmote" className="text-xs text-muted-foreground underline hover:text-foreground">Lederkalender</Link>
        </CardContent>
      </Card>

      {/* ── Finish (ONB-09) ──────────────────────────────────────────────── */}
      {!closed && (
        <Card className={h.status === "ready" ? "border-success/40" : undefined}>
          <CardContent className="flex flex-col gap-3 py-5">
            <h2 className="text-sm font-medium">Fullfør onboarding</h2>
            <p className="text-xs text-muted-foreground">
              Når alle punktene er fullført, opprettes personen som ansatt i HR med valgt tilgangsmal, og legges til i
              Tripletex og Slack.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span id="tpl-label" className="text-xs text-muted-foreground">Tilgangsmal</span>
                <Select value={template} onValueChange={setTemplate}>
                  <SelectTrigger aria-labelledby="tpl-label" className="w-[16rem] max-w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="gap-1.5" disabled={h.status !== "ready" || complete.isPending}
                onClick={() => run(() => complete.mutateAsync({ id: h.id, accessTemplate: template }))}>
                <Check className="size-4" aria-hidden /> Fullfør
              </Button>
            </div>
            {h.status !== "ready" && (
              <p className="text-xs text-muted-foreground">
                Gjenstår: {h.checklist.filter((c) => !c.done).map((c) => CHECKLIST_LABEL[c.key].toLowerCase()).join(", ")}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** ONB-03 — sendt → åpnet → signert, with the reminders in between. */
function ContractTimeline({ c, onRemind, disabled }: { c: Contract; onRemind: () => void; disabled: boolean }) {
  const steps = [
    { key: "sendt", label: "Sendt", at: c.sentAt, icon: Send },
    { key: "apnet", label: "Åpnet", at: c.seenAt, icon: Eye },
    { key: "signert", label: "Signert", at: c.signedAt, icon: Check },
  ];
  const pending = c.status === "sendt" || c.status === "apnet";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm">{c.label ?? (c.kind ? KIND_LABEL[c.kind] ?? c.kind : "Ansettelseskontrakt")}</p>
          {c.templateName && c.templateName !== c.label && (
            <p className="text-xs text-muted-foreground">Mal: {c.templateName}</p>
          )}
        </div>
        <StatusBadge status={c.status} />
      </div>
      <ol className="grid grid-cols-3 gap-2" aria-label="Signaturstatus">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.key} className={cn("flex flex-col gap-0.5 rounded-md border px-2.5 py-2",
              s.at ? "border-success/30 bg-success/5" : "border-border")}>
              <span className={cn("flex items-center gap-1.5 text-xs", s.at ? "text-foreground" : "text-muted-foreground")}>
                <Icon className="size-3.5" aria-hidden /> {s.label}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{s.at ? stampFmt.format(new Date(s.at)) : "—"}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Purringer sendt: <span className="tabular-nums">{c.remindersSent}</span>
        </span>
        {pending && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={disabled} onClick={onRemind}>
            <Bell className="size-3.5" aria-hidden /> Send purring
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Contract["status"] }) {
  const tone = status === "signert" ? "bg-success/10 text-success"
    : status === "avvist" || status === "utlopt" ? "bg-danger/10 text-danger"
      : status === "ikke-sendt" ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning-on-tint";
  return <Badge className={tone}>{CONTRACT_STATUS_LABEL[status]}</Badge>;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-2/3" />
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
    </div>
  );
}
