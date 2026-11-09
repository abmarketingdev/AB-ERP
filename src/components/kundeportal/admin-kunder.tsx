"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Building2, ChevronDown, Eye, KeyRound, Mail, Plus, RotateCcw, ShieldOff, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import {
  actorName, fmtWhen, useKundeAdminAction, useKundeCampaigns, useKundeOrgs,
  type KundeAgreement, type KundeOrg, type KundeUser,
} from "@/lib/kundeportal/admin-api";

/**
 * FR-A-03 — kundekontoer per organisasjon (ekte data, hr-service via recruitment).
 * Samme oppbygging som demoen: kort per organisasjon, «Avtale — hva kunden ser», og
 * pålogging som et eget, bevisst steg («Send pålogging»).
 */
export function AdminKunder() {
  const now = React.useMemo(() => new Date(), []);
  const orgs = useKundeOrgs();
  const action = useKundeAdminAction();
  const [creating, setCreating] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  async function act(method: "POST" | "PATCH", path: string, body?: unknown, done?: string) {
    setFailed(null);
    setOk(null);
    try {
      await action.mutateAsync({ method, path, body });
      if (done) setOk(done);
      return true;
    } catch (e) {
      setFailed(errorMessage(e));
      return false;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Kunder" description="Kundekontoer og portaltilgang" source="Kundeportalen" lastUpdated={now} />

      {failed && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{failed}</p>
      )}
      {ok && (
        <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">{ok}</p>
      )}

      <QueryBoundary
        query={orgs}
        skeleton={<Skeleton className="h-80 rounded-xl" />}
        className="flex flex-col gap-5"
      >
        {(list) => {
          const live = list.filter((o) => o.isActive && o.users.some((u) => u.isActive && u.passwordSet)).length;
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-mono tabular-nums text-foreground">{list.length}</span> organisasjoner ·{" "}
                  <span className="font-mono tabular-nums text-foreground">{live}</span> med aktiv portaltilgang
                </p>
                <Button size="sm" className="gap-1.5" onClick={() => { setCreating((v) => !v); setFailed(null); }}>
                  <Plus className="size-3.5" aria-hidden /> Ny kundekonto
                </Button>
              </div>

              {creating && (
                <CreateForm
                  pending={action.isPending}
                  onCancel={() => setCreating(false)}
                  onSubmit={async (v) => {
                    setFailed(null);
                    try {
                      const org = (await action.mutateAsync({
                        method: "POST", path: "organisations/",
                        body: { name: v.name, orgNumber: v.orgNumber, campaignIds: v.campaignIds },
                      })) as { id: string };
                      if (v.email) {
                        await action.mutateAsync({
                          method: "POST", path: `organisations/${org.id}/users/`,
                          body: { name: v.contactName, email: v.email },
                        });
                      }
                      setCreating(false);
                      setOk(`${v.name} er opprettet. Send pålogging til kontaktpersonen når avtalen er klar.`);
                    } catch (e) {
                      setFailed(errorMessage(e));
                    }
                  }}
                />
              )}

              {list.length === 0 && !creating && (
                <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
                  <p className="text-[14px] text-foreground">Ingen kundekontoer ennå</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Opprett en konto for å gi en oppdragsgiver tilgang til sin egen rapport.
                  </p>
                </div>
              )}

              <ul className="flex flex-col gap-3">
                {list.map((o) => (
                  <li key={o.id}>
                    <OrgCard org={o} pending={action.isPending} act={act} />
                  </li>
                ))}
              </ul>

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Portalpålogging krever alltid to faktorer · kunden ser bare samlede tall for sine egne kampanjer ·
                alt som gjøres her logges i kundeportalens revisjonslogg
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

type Act = (method: "POST" | "PATCH", path: string, body?: unknown, done?: string) => Promise<boolean>;

function userStatus(u: KundeUser): { text: string; tone: "ok" | "wait" | "off" } {
  if (!u.isActive) return { text: "Tilgang fjernet", tone: "off" };
  if (!u.invitedAt && !u.passwordSet) return { text: "Ingen pålogging sendt", tone: "wait" };
  if (!u.passwordSet) return { text: "Venter på passord", tone: "wait" };
  if (!u.twofaEnrolled) return { text: "Venter på app-oppsett", tone: "wait" };
  return { text: "Portaltilgang aktiv", tone: "ok" };
}

const PILL = {
  ok: "border-success/30 bg-success/10 text-success",
  wait: "border-warning/30 bg-warning/10 text-warning-on-tint",
  off: "border-border text-muted-foreground",
};

function OrgCard({ org, pending, act }: { org: KundeOrg; pending: boolean; act: Act }) {
  const [adding, setAdding] = React.useState(false);
  const [editingCampaigns, setEditingCampaigns] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ab-accent-9)]/12 text-[var(--ab-accent-11)]">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] text-foreground">{org.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              Org.nr {org.orgNumber || "—"} · opprettet {fmtWhen(org.createdAt) ?? "—"}
              {org.createdBy ? ` av ${actorName(org.createdBy)}` : ""}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {org.campaigns.length === 0 ? (
                <span className="text-warning-on-tint">Ingen kampanjer knyttet til kontoen — rapporten vil være tom.</span>
              ) : (
                <>Ser: {org.campaigns.map((c) => c.name || "Kampanje").join(", ")}</>
              )}{" "}
              <button type="button" onClick={() => setEditingCampaigns((v) => !v)}
                className="text-[var(--ab-accent-11)] underline-offset-2 hover:underline">
                {editingCampaigns ? "Lukk" : "Endre kampanjer"}
              </button>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {!org.isActive && (
            <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${PILL.off}`}>
              Organisasjonen er stengt
            </span>
          )}
          {/* Vanlig lenke (full sidelasting): klientnavigasjon hit med ?org= ble stående i
              skallets ut-animasjon (opacity 0) i Playwright. */}
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`/admin/forhandsvis?org=${org.id}`}><Eye className="size-3.5" aria-hidden /> Forhåndsvis som kunde</a>
          </Button>
        </div>
      </div>

      {editingCampaigns && (
        <div className="border-t border-border bg-secondary/25 px-5 py-4">
          <CampaignPicker
            initial={org.campaigns.map((c) => c.id)}
            pending={pending}
            onSave={async (ids) => {
              if (await act("PATCH", `organisations/${org.id}/`, { campaignIds: ids }, `Kampanjene for ${org.name} er lagret.`)) {
                setEditingCampaigns(false);
              }
            }}
          />
        </div>
      )}

      <div className="border-t border-border">
        <p className="px-5 pt-3 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">Kontaktpersoner</p>
        {org.users.length === 0 && (
          <p className="px-5 py-2 text-[12.5px] text-muted-foreground">Ingen kontaktpersoner ennå.</p>
        )}
        <ul className="divide-y divide-border">
          {org.users.map((u) => <UserRow key={u.id} user={u} org={org} pending={pending} act={act} />)}
        </ul>
        <div className="px-5 pb-3 pt-1">
          {adding ? (
            <AddUserForm
              pending={pending}
              onCancel={() => setAdding(false)}
              onSubmit={async (v) => {
                if (await act("POST", `organisations/${org.id}/users/`, v, `${v.email} er lagt til. Send pålogging når du er klar.`)) {
                  setAdding(false);
                }
              }}
            />
          ) : (
            <Button size="sm" variant="ghost" className="gap-1.5 px-2" onClick={() => setAdding(true)}>
              <UserPlus className="size-3.5" aria-hidden /> Legg til kontaktperson
            </Button>
          )}
        </div>
      </div>

      <AgreementPanel org={org} pending={pending} act={act} />
    </div>
  );
}

function UserRow({ user: u, org, pending, act }: { user: KundeUser; org: KundeOrg; pending: boolean; act: Act }) {
  const reduced = useReducedMotion();
  const [confirm, setConfirm] = React.useState<null | "revoke" | "reset-2fa" | "send-login">(null);
  const st = userStatus(u);
  const sent = fmtWhen(u.invitedAt);

  const texts = {
    "send-login": {
      q: `Sende pålogging til ${u.email}?`,
      d: "Kontaktpersonen får en e-post med lenke for å sette passord (gyldig i 72 timer). En tidligere sendt lenke slutter å virke.",
      b: "Send pålogging",
      done: `Pålogging er sendt til ${u.email}.`,
    },
    revoke: {
      q: `Fjerne tilgangen for ${u.name || u.email}?`,
      d: "Påloggingen slutter å virke umiddelbart, også en rapport som er åpen nå. Kontoen og historikken beholdes.",
      b: "Fjern tilgang",
      done: `Tilgangen for ${u.email} er fjernet.`,
    },
    "reset-2fa": {
      q: `Nullstille appen for ${u.name || u.email}?`,
      d: "Brukes når kontaktpersonen har mistet telefonen. Alle økter avsluttes, og appen settes opp på nytt ved neste innlogging.",
      b: "Nullstill",
      done: `Appen for ${u.email} er nullstilt.`,
    },
  } as const;

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] text-foreground">{u.name || u.email}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{u.email}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${PILL[st.tone]}`}>
          {st.text}
        </span>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
        <Field label="Pålogging sendt" value={sent ? `${sent}${u.invitedBy ? ` · ${actorName(u.invitedBy)}` : ""}` : "Ikke sendt"} />
        <Field label="Sist pålogget" value={fmtWhen(u.lastLoginAt) ?? "Aldri"} />
        {!u.isActive && u.revokedAt && (
          <Field label="Tilgang fjernet" value={`${fmtWhen(u.revokedAt)}${u.revokedBy ? ` · ${actorName(u.revokedBy)}` : ""}`} />
        )}
      </dl>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {u.isActive ? (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={pending || !org.isActive}
              onClick={() => setConfirm("send-login")}>
              <Mail className="size-3.5" aria-hidden /> {sent ? "Send ny pålogging" : "Send pålogging"}
            </Button>
            {u.twofaEnrolled && (
              <Button size="sm" variant="ghost" className="gap-1.5" disabled={pending} onClick={() => setConfirm("reset-2fa")}>
                <RotateCcw className="size-3.5" aria-hidden /> Nullstill app
              </Button>
            )}
            <Button size="sm" variant="ghost" className="gap-1.5 text-danger" disabled={pending} onClick={() => setConfirm("revoke")}>
              <ShieldOff className="size-3.5" aria-hidden /> Fjern tilgang
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={pending}
            onClick={() => void act("POST", `users/${u.id}/restore/`, {}, `${u.email} har fått tilgang igjen. Send ny pålogging om nødvendig.`)}>
            <KeyRound className="size-3.5" aria-hidden /> Gi tilgang igjen
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {confirm && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <p className="text-[13px] text-foreground">{texts[confirm].q}</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{texts[confirm].d}</p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" variant={confirm === "send-login" ? "default" : "destructive"} disabled={pending}
                  onClick={async () => {
                    const kind = confirm;
                    if (await act("POST", `users/${u.id}/${kind}/`, {}, texts[kind].done)) setConfirm(null);
                  }}>
                  {texts[confirm].b}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Avbryt</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

const FIGURES: { key: string; label: string; note: string }[] = [
  { key: "donorsAcquired", label: "Givere rekruttert", note: "Hovedtallet i rapporten (foreløpige vises på egen linje)" },
  { key: "averageMonthlyGift", label: "Snitt månedsbeløp", note: "Gjennomsnittlig avtalt beløp" },
  { key: "totalPaid", label: "Totalt innbetalt", note: "Krever avklart definisjon" },
  { key: "retention90", label: "Aktive etter 90 dager", note: "Krever historikk (kommer senere)" },
  { key: "campaignCost", label: "Kampanjekostnad", note: "Krever avklart definisjon" },
  { key: "costPerDonor", label: "Kostnad per giver", note: "Bygger på kampanjekostnad" },
];
const GRAN: { key: string; label: string }[] = [{ key: "month", label: "Måned" }, { key: "year", label: "År (akkumulert)" }];

function AgreementPanel({ org, pending, act }: { org: KundeOrg; pending: boolean; act: Act }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const a = org.agreement;

  const patch = (next: Partial<KundeAgreement>) => void act("PATCH", `organisations/${org.id}/agreement/`, next);
  const toggleFigure = (key: string) =>
    patch({ figures: a.figures.includes(key) ? a.figures.filter((f) => f !== key)
      : FIGURES.map((f) => f.key).filter((f) => f === key || a.figures.includes(f)) });
  const toggleGran = (key: string) => {
    const next = a.granularities.includes(key) ? a.granularities.filter((g) => g !== key)
      : GRAN.map((g) => g.key).filter((g) => g === key || a.granularities.includes(g));
    if (next.length) patch({ granularities: next });
  };

  const summary = `${a.figures.length} av ${FIGURES.length} tall · ${a.granularities
    .map((g) => (g === "month" ? "måned" : "år")).join(", ")}${a.updatedBy ? ` · sist endret av ${actorName(a.updatedBy)}` : ""}`;

  return (
    <div className="border-t border-border">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-[120ms] hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="min-w-0">
          <span className="block text-[13px] text-foreground">Avtale — hva kunden ser</span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground" title={summary}>{summary}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 border-t border-border bg-secondary/25 px-5 py-4">
              <fieldset className="min-w-0">
                <legend className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">Tall i rapporten</legend>
                <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  {FIGURES.map((f) => (
                    <Check key={f.key} checked={a.figures.includes(f.key)} disabled={pending}
                      onChange={() => toggleFigure(f.key)} label={f.label} note={f.note} />
                  ))}
                </div>
                <div className="mt-1 border-t border-border/70 pt-1">
                  <Check checked={a.costDefinitionAgreed} disabled={pending}
                    onChange={() => patch({ costDefinitionAgreed: !a.costDefinitionAgreed })}
                    label="Definisjonen av kampanjekostnad er avklart med kunden"
                    note="Kostnadstallene vises fortsatt som «avklart definisjon» til det finnes en kostnadskilde" />
                </div>
              </fieldset>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <fieldset className="min-w-0">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">Periodeinndeling</legend>
                  <div className="mt-2.5 flex flex-col">
                    {GRAN.map((g) => (
                      <Check key={g.key} checked={a.granularities.includes(g.key)}
                        disabled={pending || (a.granularities.length === 1 && a.granularities.includes(g.key))}
                        onChange={() => toggleGran(g.key)} label={g.label} />
                    ))}
                  </div>
                </fieldset>
                <fieldset className="min-w-0">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">Innsatsen bak tallene</legend>
                  <div className="mt-2.5 flex flex-col">
                    <Check checked={false} disabled onChange={() => undefined}
                      label="Vis samlede tall om feltarbeidet"
                      note="Kommer i neste versjon — antall ververe, dager i felt og snitt, aldri enkeltpersoner" />
                  </div>
                </fieldset>
              </div>
              <p className="max-w-prose text-[12px] leading-relaxed text-muted-foreground">
                Endringer trer i kraft med én gang, også for en rapport kunden har åpen. Tall som ikke er med i
                avtalen blir ikke beregnet for kunden i det hele tatt.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CampaignPicker({ initial, pending, onSave }: { initial: string[]; pending: boolean; onSave: (ids: string[]) => void }) {
  const campaigns = useKundeCampaigns();
  const [ids, setIds] = React.useState<string[]>(initial);
  return (
    <fieldset>
      <legend className="text-[12px] text-muted-foreground">Kampanjer kontoen skal se</legend>
      {campaigns.isPending ? (
        <Skeleton className="mt-2 h-8 w-full" />
      ) : campaigns.isError ? (
        <p className="mt-2 text-[12.5px] text-danger">{errorMessage(campaigns.error)}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {campaigns.data.map((c) => {
            const on = ids.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on}
                onClick={() => setIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "border-[var(--ab-accent-9)]/40 bg-[var(--ab-accent-9)]/12 text-[var(--ab-accent-11)]"
                    : "border-border text-muted-foreground hover:text-foreground"}`}>
                {c.name || "Uten navn"}{!c.isActive && " (inaktiv)"}
              </button>
            );
          })}
        </div>
      )}
      <Button size="sm" className="mt-3" disabled={pending} onClick={() => onSave(ids)}>Lagre kampanjer</Button>
    </fieldset>
  );
}

function AddUserForm({ pending, onCancel, onSubmit }: {
  pending: boolean; onCancel: () => void; onSubmit: (v: { name: string; email: string }) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  return (
    <form className="mt-2 flex flex-wrap items-end gap-3"
      onSubmit={(e) => { e.preventDefault(); if (emailOk) onSubmit({ name: name.trim(), email: email.trim() }); }}>
      <Labelled id="nu-name" label="Navn"><Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} /></Labelled>
      <Labelled id="nu-email" label="E-post">
        <Input id="nu-email" type="email" autoCapitalize="none" spellCheck={false} value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </Labelled>
      <Button size="sm" type="submit" disabled={!emailOk || pending}>Legg til</Button>
      <Button size="sm" type="button" variant="ghost" onClick={onCancel}>Avbryt</Button>
    </form>
  );
}

function CreateForm({ pending, onCancel, onSubmit }: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (v: { name: string; orgNumber: string; contactName: string; email: string; campaignIds: string[] }) => void;
}) {
  const campaigns = useKundeCampaigns();
  const [name, setName] = React.useState("");
  const [orgNumber, setOrgNumber] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [ids, setIds] = React.useState<string[]>([]);
  const emailOk = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const complete = name.trim() && emailOk;

  return (
    <form className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit({ name: name.trim(), orgNumber: orgNumber.trim(), contactName: contactName.trim(), email: email.trim(), campaignIds: ids });
      }}>
      <p className="text-[14px] text-foreground">Ny kundekonto</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Labelled id="org" label="Organisasjon"><Input id="org" value={name} onChange={(e) => setName(e.target.value)} required /></Labelled>
        <Labelled id="orgnr" label="Organisasjonsnummer"><Input id="orgnr" value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} inputMode="numeric" /></Labelled>
        <Labelled id="contact" label="Kontaktperson"><Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} /></Labelled>
        <Labelled id="email" label="E-post" hint={!emailOk ? "Skriv en gyldig e-postadresse." : undefined}>
          <Input id="email" type="email" autoCapitalize="none" spellCheck={false} value={email}
            onChange={(e) => setEmail(e.target.value)} aria-invalid={!emailOk} />
        </Labelled>
      </div>
      <fieldset>
        <legend className="text-[12px] text-muted-foreground">Kampanjer kontoen skal se</legend>
        {campaigns.isPending ? <Skeleton className="mt-2 h-8 w-full" /> : campaigns.isError ? (
          <p className="mt-2 text-[12.5px] text-danger">{errorMessage(campaigns.error)}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {campaigns.data.filter((c) => c.isActive).map((c) => {
              const on = ids.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on}
                  onClick={() => setIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    on ? "border-[var(--ab-accent-9)]/40 bg-[var(--ab-accent-9)]/12 text-[var(--ab-accent-11)]"
                      : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {c.name || "Uten navn"}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
      <p className="text-[12.5px] text-muted-foreground">
        Kontoen opprettes uten pålogging. Avtalen starter med bare «Givere rekruttert»; pålogging sendes som et eget steg.
      </p>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={!complete || pending}>{pending ? "Oppretter…" : "Opprett konto"}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>Avbryt</Button>
      </div>
    </form>
  );
}

function Check({ checked, disabled, onChange, label, note }: {
  checked: boolean; disabled?: boolean; onChange: () => void; label: string; note?: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1 sm:min-h-8">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-[var(--ab-accent-9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <span className="min-w-0">
        <span className="block text-[13px] text-foreground">{label}</span>
        {note && <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{note}</span>}
      </span>
    </label>
  );
}

function Labelled({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[12px] text-danger" role="alert">{hint}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] text-foreground">{value}</dd>
    </div>
  );
}
