"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Camera, Package, FileSignature, Send, Bell, UserX, Lock,
} from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useNewHire, useCheckOnboarding, useContractAction, useUploadPhoto,
  useHandOutEquipment, useEquipmentContract, useFirstDayNoShow,
} from "@/lib/api/srs";
import { errorMessage } from "@/lib/api/client";
import {
  CHECKLIST_LABEL, CONTRACT_STATUS_LABEL, EQUIPMENT_KINDS, handOutEquipmentSchema, type NewHire,
} from "@/types/onboarding";

/**
 * ONB-02 … ONB-09 — the onboarding of one person.
 *
 * The screen is ordered the way the process runs — contract, photo, equipment,
 * first day — rather than grouped by data type, because it is worked through
 * top to bottom by somebody with the new starter in front of them.
 *
 * Two rules are enforced rather than described, and both refuse with a reason:
 * the first working day cannot be ticked until the contract is signed (ONB-03),
 * and the equipment contract cannot be sent before anything has been handed out
 * (ONB-07 — it is the employee confirming receipt, so there must be something
 * to confirm).
 */

const dateFmt = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" });
const stampFmt = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" });

export default function OnboardingDetail() {
  const { id } = useParams<{ id: string }>();
  const hire = useNewHire(id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        href="/onboarding"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tilbake til onboarding
      </Link>

      <QueryBoundary
        query={hire}
        skeleton={<Skeleton className="h-96 w-full rounded-lg" />}
        className="flex flex-col gap-6"
      >
        {(h) => <Detail hire={h} />}
      </QueryBoundary>
    </div>
  );
}

function Detail({ hire: h }: { hire: NewHire }) {
  const check = useCheckOnboarding();
  const contract = useContractAction();
  const photo = useUploadPhoto();
  const handOut = useHandOutEquipment();
  const eqContract = useEquipmentContract();
  const noShow = useFirstDayNoShow();

  const [error, setError] = React.useState<string | null>(null);
  const [eq, setEq] = React.useState({ kind: EQUIPMENT_KINDS[0], model: "", serial: "" });
  const [eqErrors, setEqErrors] = React.useState<Record<string, string>>({});
  const [noShowNote, setNoShowNote] = React.useState("");
  const [noShowOpen, setNoShowOpen] = React.useState(false);

  const done = h.checklist.filter((c) => c.done).length;
  const pct = Math.round((done / h.checklist.length) * 100);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); } catch (err) { setError(errorMessage(err)); }
  }

  async function addEquipment() {
    const parsed = handOutEquipmentSchema.safeParse(eq);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setEqErrors(next);
      return;
    }
    setEqErrors({});
    await run(async () => {
      await handOut.mutateAsync({ id: h.id, ...eq });
      setEq({ kind: EQUIPMENT_KINDS[0], model: "", serial: "" });
    });
  }

  return (
    <>
      <PageHeader
        title={h.name}
        description={`${h.team} · ${h.campaign} · starter ${dateFmt.format(new Date(h.startDate))}`}
        source={`Registrert av ${h.registeredBy}`}
        lastUpdated={new Date()}
      />

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {h.completedAt && (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden />
          Onboardingen er fullført. {h.name} er opprettet som ansatt med tilgangsmalen «Promotør».
        </p>
      )}

      {/* ── Checklist (ONB-05) ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Sjekkliste</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{done}/{h.checklist.length} fullført</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <ul className="flex flex-col divide-y divide-border">
            {h.checklist.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={c.done}
                    disabled={check.isPending}
                    onCheckedChange={(v) => run(() => check.mutateAsync({ id: h.id, key: c.key, done: Boolean(v) }))}
                  />
                  <span className={c.done ? "text-muted-foreground line-through" : undefined}>
                    {CHECKLIST_LABEL[c.key]}
                  </span>
                </label>
                {c.at && <span className="text-xs tabular-nums text-muted-foreground">{stampFmt.format(new Date(c.at))}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── Contract (ONB-02, ONB-03, ONB-04) ──────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <FileSignature className="size-4 text-muted-foreground" aria-hidden /> Arbeidskontrakt
            </h2>
            <Badge className={h.contract.status === "signert" ? "bg-success/10 text-success" : "bg-warning/10 text-warning-on-tint"}>
              {CONTRACT_STATUS_LABEL[h.contract.status]}
            </Badge>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Mal i signeringsløsningen" value={h.contract.templateId ?? "—"} mono />
            <Row label="Sendt" value={h.contract.sentAt ? stampFmt.format(new Date(h.contract.sentAt)) : "—"} />
            <Row label="Signert" value={h.contract.signedAt ? stampFmt.format(new Date(h.contract.signedAt)) : "—"} />
            <Row label="Purringer sendt" value={String(h.contract.remindersSent)} />
          </dl>
          <p className="text-xs text-muted-foreground">
            Endringer i kontraktmalene skal meldes til Dana før de tas i bruk, slik at onboarding og
            offboarding fortsetter å virke.
          </p>
          <div className="flex flex-wrap gap-2">
            {h.contract.status === "ikke-sendt" && (
              <Button size="sm" className="gap-1.5" disabled={contract.isPending}
                onClick={() => run(() => contract.mutateAsync({ id: h.id, action: "send" }))}>
                <Send className="size-4" /> Send til signering
              </Button>
            )}
            {h.contract.status !== "signert" && h.contract.status !== "ikke-sendt" && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={contract.isPending}
                  onClick={() => run(() => contract.mutateAsync({ id: h.id, action: "remind" }))}>
                  <Bell className="size-4" /> Send purring
                </Button>
                <Button size="sm" variant="ghost" disabled={contract.isPending}
                  onClick={() => run(() => contract.mutateAsync({ id: h.id, action: "sign" }))}>
                  Marker som signert
                </Button>
              </>
            )}
          </div>
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
                : "Ole tar bildet og kobler det til personen."}
            </p>
          </div>
          {h.photo ? (
            <Badge className="bg-success/10 text-success">Lagt inn</Badge>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={photo.isPending}
              onClick={() => run(() => photo.mutateAsync({ id: h.id }))}>
              <Camera className="size-4" /> Last opp bilde
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Equipment + equipment contract (ONB-07) ─────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Package className="size-4 text-muted-foreground" aria-hidden /> Utstyr
          </h2>

          {h.equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingenting utlevert ennå.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                      <td className="py-2 font-mono text-xs">{e.serial}</td>
                      <td className="py-2 text-xs tabular-nums text-muted-foreground">
                        {stampFmt.format(new Date(e.handedOutAt))} · {e.handedOutBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eq-kind" className="text-xs text-muted-foreground">Type</Label>
              <Select value={eq.kind} onValueChange={(v) => setEq((s) => ({ ...s, kind: v }))}>
                <SelectTrigger id="eq-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eq-model" className="text-xs text-muted-foreground">Modell</Label>
              <Input id="eq-model" value={eq.model} onChange={(e) => setEq((s) => ({ ...s, model: e.target.value }))} />
              {eqErrors.model && <p className="text-xs text-danger">{eqErrors.model}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eq-serial" className="text-xs text-muted-foreground">Serienummer</Label>
              <Input id="eq-serial" className="font-mono" value={eq.serial} onChange={(e) => setEq((s) => ({ ...s, serial: e.target.value }))} />
              {eqErrors.serial && <p className="text-xs text-danger">{eqErrors.serial}</p>}
            </div>
            <Button size="sm" disabled={handOut.isPending} onClick={addEquipment}>Registrer</Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Utstyrskontrakt</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Signeres etter utlevering, der den ansatte bekrefter mottatt utstyr.
                {h.equipmentContract.signedAt && ` Signert ${stampFmt.format(new Date(h.equipmentContract.signedAt))}.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={h.equipmentContract.status === "signert" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                {CONTRACT_STATUS_LABEL[h.equipmentContract.status]}
              </Badge>
              {h.equipmentContract.status === "ikke-sendt" && (
                <Button size="sm" variant="outline" disabled={eqContract.isPending}
                  onClick={() => run(() => eqContract.mutateAsync({ id: h.id, action: "send" }))}>
                  Send til signering
                </Button>
              )}
              {h.equipmentContract.status === "sendt" && (
                <Button size="sm" variant="ghost" disabled={eqContract.isPending}
                  onClick={() => run(() => eqContract.mutateAsync({ id: h.id, action: "sign" }))}>
                  Marker som signert
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── First day no-show (ONB-08) ──────────────────────────────────── */}
      <Card className={h.firstDayNoShow ? "border-danger/40" : undefined}>
        <CardContent className="flex flex-col gap-3 py-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <UserX className="size-4 text-muted-foreground" aria-hidden /> Første arbeidsdag
          </h2>
          {h.firstDayNoShow ? (
            <p className="text-sm">
              Registrert som ikke møtt {stampFmt.format(new Date(h.firstDayNoShow.at))},
              fulgt opp av {h.firstDayNoShow.followedUpBy}. {h.firstDayNoShow.note}
            </p>
          ) : noShowOpen ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ns-note">Hva skjedde da dere fulgte opp?</Label>
                <Textarea id="ns-note" rows={2} value={noShowNote} onChange={(e) => setNoShowNote(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Nasrin varsles når dette registreres.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-danger" disabled={noShow.isPending || !noShowNote.trim()}
                  onClick={() => run(async () => { await noShow.mutateAsync({ id: h.id, note: noShowNote.trim() }); setNoShowOpen(false); })}>
                  Registrer ikke møtt
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNoShowOpen(false)}>Avbryt</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Starter {dateFmt.format(new Date(h.startDate))}.
              </p>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setNoShowOpen(true)}>
                Møtte ikke første dag
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 sm:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "tabular-nums"}>{value}</dd>
    </div>
  );
}
