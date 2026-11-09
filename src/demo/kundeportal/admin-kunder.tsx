"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Building2, ChevronDown, KeyRound, Plus, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomerAccounts,
  useCreateCustomerAccount,
  useProvisionCustomer,
  useUpdateAgreement,
} from "@/lib/api/quality";
import { errorMessage } from "@/lib/api/client";
import { CAMPAIGNS } from "@/lib/mock-data";
import { CUSTOMER_FIGURES } from "@/types/quality";
import type { CustomerAccount, CustomerAgreement, CustomerFigureKey } from "@/types/quality";

/**
 * FR-A-03 — create customer accounts and provision portal logins.
 *
 * The two are deliberately separate acts, and the screen refuses to merge them.
 * Registering an organisation is bookkeeping; giving somebody outside the
 * company a working login into reports about named fundraisers is a decision
 * with consequences. Creating an account therefore never provisions access —
 * that is a second, explicit click, and withdrawing it is one click too.
 *
 * Each account states which campaigns it can see, because that is the whole
 * extent of what the customer portal will show them (FR-C-*). An account with no
 * campaigns is not a customer who sees nothing; it is a configuration mistake,
 * and the screen says so rather than rendering an empty portal later.
 */
export default function AdminKunder() {
  const now = new Date();
  const accounts = useCustomerAccounts();
  const create = useCreateCustomerAccount();
  const provision = useProvisionCustomer();
  const [creating, setCreating] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Kunder"
        description="Kundekontoer og portaltilgang"
        source="Tilgangsstyring"
        lastUpdated={now}
      />

      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {failed}
        </p>
      )}

      <QueryBoundary
        query={accounts}
        skeleton={<Skeleton className="h-80 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen kundekontoer"
        emptyDescription="Opprett en konto for å gi en oppdragsgiver tilgang til sin egen rapport."
        className="flex flex-col gap-5"
      >
        {(list) => {
          const live = list.filter((c) => c.provisioned).length;
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-mono tabular-nums text-foreground">{list.length}</span>{" "}
                  kontoer ·{" "}
                  <span className="font-mono tabular-nums text-foreground">{live}</span> med aktiv
                  portaltilgang
                </p>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setCreating((v) => !v);
                    setFailed(null);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Ny kundekonto
                </Button>
              </div>

              {creating && (
                <CreateForm
                  pending={create.isPending}
                  onCancel={() => setCreating(false)}
                  onSubmit={(vals) => {
                    setFailed(null);
                    create.mutate(vals, {
                      onSuccess: () => setCreating(false),
                      onError: (e) => setFailed(errorMessage(e)),
                    });
                  }}
                />
              )}

              <ul className="flex flex-col gap-3">
                {list.map((c) => (
                  <li key={c.id}>
                    <AccountCard
                      account={c}
                      pending={provision.isPending}
                      confirming={confirming === c.id}
                      onAskConfirm={() => setConfirming(c.id)}
                      onCancel={() => setConfirming(null)}
                      onProvision={(next) => {
                        setFailed(null);
                        setConfirming(null);
                        provision.mutate(
                          { id: c.id, provisioned: next },
                          { onError: (e) => setFailed(errorMessage(e)) },
                        );
                      }}
                    />
                  </li>
                ))}
              </ul>

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Portalpålogging krever alltid to faktorer (FR-S-02) · oppretting og tildeling av
                tilgang logges hver for seg i revisjonsloggen
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function AccountCard({
  account,
  pending,
  confirming,
  onAskConfirm,
  onCancel,
  onProvision,
}: {
  account: CustomerAccount;
  pending: boolean;
  confirming: boolean;
  onAskConfirm: () => void;
  onCancel: () => void;
  onProvision: (next: boolean) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ab-accent-9)]/12 text-[var(--ab-accent-11)]">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] text-foreground">{account.organisation}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              Org.nr {account.orgNumber} · {account.contactName} · {account.email}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {account.campaigns.length === 0 ? (
                <span className="text-warning">
                  Ingen kampanjer knyttet til kontoen — rapporten vil være tom.
                </span>
              ) : (
                <>Ser: {account.campaigns.join(", ")}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Status in text, never colour alone (WCAG 1.4.1). */}
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              account.provisioned
                ? "border-success/30 bg-success/10 text-success"
                : "border-border text-muted-foreground"
            }`}
          >
            {account.provisioned ? "Portaltilgang aktiv" : "Ingen portaltilgang"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={pending}
            onClick={onAskConfirm}
          >
            {account.provisioned ? (
              <>
                <ShieldOff className="size-3.5" aria-hidden />
                Fjern tilgang
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" aria-hidden />
                Gi portaltilgang
              </>
            )}
          </Button>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border px-5 py-3">
        <Field label="Opprettet" value={account.createdAt} />
        <Field
          label="Tilgang gitt"
          value={
            account.provisionedAt
              ? `${account.provisionedAt}${account.provisionedBy ? ` · ${account.provisionedBy}` : ""}`
              : "—"
          }
        />
        {/* FR-C-12 — the credentials were made by a person and sent by email;
            the record of that is part of the account, not folklore. */}
        <Field
          label="Pålogging sendt"
          value={
            account.credentialsSentAt
              ? `${account.credentialsSentTo} · ${account.credentialsSentAt}`
              : "Ikke sendt"
          }
        />
        <Field label="Sist pålogget" value={account.lastLogin ?? "Aldri"} />
      </dl>

      <AgreementPanel account={account} />

      {confirming && (
        <motion.div
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          <div className="border-t border-border bg-secondary/40 px-5 py-3.5">
            <p className="text-[13px] text-foreground">
              {account.provisioned
                ? `Fjerne portaltilgangen for ${account.organisation}?`
                : `Gi ${account.contactName} tilgang til rapporten for ${account.organisation}?`}
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {account.provisioned
                ? "Påloggingen slutter å virke umiddelbart. Kontoen og historikken beholdes."
                : `Det opprettes en pålogging på ${account.email} med tofaktor. Kontoen ser kun sine egne kampanjer.`}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                variant={account.provisioned ? "destructive" : "default"}
                onClick={() => onProvision(!account.provisioned)}
              >
                {account.provisioned ? "Fjern tilgang" : "Gi tilgang"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Avbryt
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** The figures, in the order they are presented to the customer. */
const FIGURE_LABELS: Record<CustomerFigureKey, { label: string; note: string }> = {
  donorsAcquired: { label: "Givere rekruttert", note: "Hovedtallet i rapporten" },
  totalPaid: { label: "Totalt innbetalt", note: "Sum fra giverne i perioden" },
  averageMonthlyGift: { label: "Snitt månedsbeløp", note: "Gjennomsnittlig avtalt beløp" },
  retention90: { label: "Aktive etter 90 dager", note: "Andel avtaler som består" },
  campaignCost: { label: "Kampanjekostnad", note: "Krever avklart definisjon" },
  costPerDonor: { label: "Kostnad per giver", note: "Bygger på kampanjekostnad" },
};

const GRANULARITY_LABELS: Record<"week" | "month" | "year", string> = {
  week: "Uke",
  month: "Måned",
  year: "År",
};

/**
 * FR-C-07 — the agreement, as an editable thing.
 *
 * This panel is the whole reason the requirement says "configuration, not a
 * hardcoded view". What is ticked here is what the customer's endpoint computes;
 * an unticked figure is never calculated and never appears in a response body.
 *
 * It is collapsed by default and states its effect in one line when closed,
 * because the common visit to this screen is "did they get their login", not
 * "let us renegotiate the contract". Opening it is a deliberate act, and every
 * change is audited with before and after.
 */
function AgreementPanel({ account }: { account: CustomerAccount }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const update = useUpdateAgreement();
  const a = account.agreement;

  function patch(next: Partial<CustomerAgreement>) {
    setFailed(null);
    update.mutate(
      { id: account.id, agreement: next },
      { onError: (e) => setFailed(errorMessage(e)) },
    );
  }

  function toggleFigure(key: CustomerFigureKey) {
    const next = a.figures.includes(key)
      ? a.figures.filter((f) => f !== key)
      : // Keep the presentation order stable no matter what order they were ticked.
        (Object.keys(FIGURE_LABELS) as CustomerFigureKey[]).filter(
          (f) => f === key || a.figures.includes(f),
        );
    patch({ figures: next });
  }

  function toggleGranularity(key: "week" | "month" | "year") {
    const next = a.granularities.includes(key)
      ? a.granularities.filter((g) => g !== key)
      : (["week", "month", "year"] as const).filter(
          (g) => g === key || a.granularities.includes(g),
        );
    patch({ granularities: [...next] });
  }

  const summary = `${a.figures.length} av ${CUSTOMER_FIGURES.length} tall · ${
    a.fieldworkDetail === "aggregate" ? "innsats synlig" : "innsats skjult"
  } · ${a.granularities.map((g) => GRANULARITY_LABELS[g].toLowerCase()).join(", ")}`;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-[120ms] hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-[13px] text-foreground">Avtale — hva kunden ser</span>
          <span
            className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground"
            title={summary}
          >
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
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
              {failed && (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                  {failed}
                </p>
              )}

              <fieldset className="min-w-0">
                <legend className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                  Tall i rapporten
                </legend>
                <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  {(Object.keys(FIGURE_LABELS) as CustomerFigureKey[]).map((key) => (
                    <Check
                      key={key}
                      checked={a.figures.includes(key)}
                      disabled={update.isPending}
                      onChange={() => toggleFigure(key)}
                      label={FIGURE_LABELS[key].label}
                      note={FIGURE_LABELS[key].note}
                    />
                  ))}
                </div>
                {/* This gates the two cost figures above rather than standing on
                    its own, so it sits with them (FR-C-11). */}
                <div className="mt-1 border-t border-border/70 pt-1">
                  <Check
                    checked={a.costDefinitionAgreed}
                    disabled={update.isPending}
                    onChange={() => patch({ costDefinitionAgreed: !a.costDefinitionAgreed })}
                    label="Definisjonen av kampanjekostnad er avklart med kunden"
                    note="Til dette er huket av holdes kampanjekostnad og kostnad per giver tilbake, selv om de er huket av over"
                  />
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <fieldset className="min-w-0">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                    Periodeinndeling
                  </legend>
                  <div className="mt-2.5 flex flex-col">
                    {(["week", "month", "year"] as const).map((g) => (
                      <Check
                        key={g}
                        checked={a.granularities.includes(g)}
                        disabled={update.isPending}
                        onChange={() => toggleGranularity(g)}
                        label={GRANULARITY_LABELS[g]}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                    Innsatsen bak tallene
                  </legend>
                  <div className="mt-2.5 flex flex-col">
                    <Check
                      checked={a.fieldworkDetail === "aggregate"}
                      disabled={update.isPending}
                      onChange={() =>
                        patch({
                          fieldworkDetail: a.fieldworkDetail === "aggregate" ? "none" : "aggregate",
                        })
                      }
                      label="Vis samlede tall om feltarbeidet"
                      note="Antall ververe, dager i felt og snitt — aldri enkeltpersoner"
                    />
                  </div>
                </fieldset>
              </div>

              <p className="max-w-prose text-[12px] leading-relaxed text-muted-foreground">
                Endringer trer i kraft med én gang, også for en rapport kunden har åpen. Alt som
                endres her havner i revisjonsloggen med verdien før og etter.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A checkbox that stays a real checkbox — label, focus ring, touch floor. */
function Check({
  checked,
  disabled,
  onChange,
  label,
  note,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
  note?: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1 sm:min-h-8">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-[var(--ab-accent-9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-foreground">{label}</span>
        {note && <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{note}</span>}
      </span>
    </label>
  );
}

function CreateForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (v: {
    organisation: string;
    orgNumber: string;
    contactName: string;
    email: string;
    campaigns: string[];
  }) => void;
}) {
  const [organisation, setOrganisation] = React.useState("");
  const [orgNumber, setOrgNumber] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [campaigns, setCampaigns] = React.useState<string[]>([]);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const complete = organisation.trim() && orgNumber.trim() && contactName.trim() && emailOk;

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) {
          onSubmit({
            organisation: organisation.trim(),
            orgNumber: orgNumber.trim(),
            contactName: contactName.trim(),
            email: email.trim(),
            campaigns,
          });
        }
      }}
    >
      <p className="text-[14px] text-foreground">Ny kundekonto</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Labelled id="org" label="Organisasjon">
          <Input id="org" value={organisation} onChange={(e) => setOrganisation(e.target.value)} required />
        </Labelled>
        <Labelled id="orgnr" label="Organisasjonsnummer">
          <Input id="orgnr" value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} inputMode="numeric" required />
        </Labelled>
        <Labelled id="contact" label="Kontaktperson">
          <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </Labelled>
        <Labelled
          id="email"
          label="E-post"
          hint={email.trim() && !emailOk ? "Skriv en gyldig e-postadresse." : undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(email.trim()) && !emailOk}
            required
          />
        </Labelled>
      </div>

      <fieldset>
        <legend className="text-[12px] text-muted-foreground">
          Kampanjer kontoen skal se
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAMPAIGNS.map((c) => {
            const on = campaigns.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setCampaigns((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                }
                className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on
                    ? "border-[var(--ab-accent-9)]/40 bg-[var(--ab-accent-9)]/12 text-[var(--ab-accent-11)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="text-[12.5px] text-muted-foreground">
        Kontoen opprettes uten pålogging. Portaltilgang gis som et eget steg etterpå.
      </p>

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={!complete || pending}>
          {pending ? "Oppretter…" : "Opprett konto"}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}

function Labelled({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p className="mt-1 text-[12px] text-danger" role="alert">
          {hint}
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-[12.5px] text-foreground">{value}</dd>
    </div>
  );
}
