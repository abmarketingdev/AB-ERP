"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Search, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { EmptyState } from "@/components/patterns/empty-state";
import { SelectableButton } from "@/components/patterns/selectable-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAccessTemplates,
  usePermissionCatalogue,
  useSetModule,
  useSetPermission,
  useSetTemplate,
  useSetUserActive,
  useUserAccess,
} from "@/lib/api/quality";
import { errorMessage } from "@/lib/api/client";
import { effectivePermissions, provenanceOf, type Provenance } from "@/lib/access";
import { IS_MOCK } from "@/lib/data-source";
import { mascotFor } from "@/lib/use-mascot";
import type { Permission, UserAccess } from "@/types/quality";

/**
 * SRS §2.2 «Tilgang er modulbasert og settes per bruker … (hent inspirasjon fra Microsoft
 * Teams)» and §8.1 l.735. The shape follows Teams' app-permission policies: a person gets a
 * TEMPLATE (the policy), and anything else is an exception someone made and had to justify.
 *
 * So the screen leads with the template («Mal: Rekrutterer · Endre mal») — the one change
 * an admin makes most — then the modules as switches (on / off / partly), and keeps
 * individual exceptions in their own section, because they are what an audit asks about.
 * Every change takes a reason and is written to the audit log with before and after.
 */

/** Module key → the group a person recognises (master, design review round 1). */
const GROUPS: { title: string; modules: string[] }[] = [
  { title: "Samleinnboks", modules: ["leads", "stand"] },
  { title: "Kandidater", modules: ["candidates", "candidates_master", "private_notes", "audience_export", "recman_import", "recruitment"] },
  { title: "Annonser", modules: ["ads"] },
  { title: "Intervjuer", modules: ["booking", "interviews_own", "interviews"] },
  { title: "Godkjenning", modules: ["approval"] },
  { title: "Onboarding", modules: ["onboarding"] },
  { title: "Ansatte", modules: ["employees"] },
  { title: "Bemanning og vaktplan", modules: ["staffing", "schedule", "promoter", "leader", "saleschief"] },
  { title: "Oppgaver", modules: ["tasks"] },
  { title: "Dashboard", modules: ["dashboard", "recruitdash", "kpi"] },
  { title: "Personvern", modules: ["privacy"] },
  { title: "Administrasjon", modules: ["access", "audit", "integrations", "notify", "admin", "import", "privatenotes"] },
];

const moduleOf = (p: Permission) => p.module ?? p.key.split(".")[0];

type Filter = "with" | "without" | "inactive";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "with", label: "Med tilgang" },
  { key: "without", label: "Uten tilgang" },
  { key: "inactive", label: "Deaktivert" },
];

function bucket(u: UserAccess): Filter {
  if (!u.active) return "inactive";
  return effectivePermissions(u).length > 0 ? "with" : "without";
}

type Pending = {
  title: string;
  body: string;
  run: (reason: string) => void;
};

export default function AdminTilganger() {
  const users = useUserAccess();
  const catalogue = usePermissionCatalogue();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("with");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Tilganger"
        description="Hvem har hvilke moduler: malen er utgangspunktet, unntakene står for seg"
        source="Tilgangsstyring"
        lastUpdated={users.dataUpdatedAt ? new Date(users.dataUpdatedAt) : new Date()}
      />

      <QueryBoundary
        query={users}
        skeleton={
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Skeleton className="h-[28rem] rounded-xl" />
            <Skeleton className="h-[28rem] rounded-xl" />
          </div>
        }
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen brukere ennå"
        emptyDescription="Brukerne hentes fra innloggingen. Nye ansatte dukker opp her etter at kontoen er opprettet."
        className="flex flex-1 flex-col gap-4"
      >
        {(list) => {
          const needle = q.trim().toLowerCase();
          const counts = { with: 0, without: 0, inactive: 0 } as Record<Filter, number>;
          for (const u of list) counts[bucket(u)]++;
          const matches = list.filter(
            (u) =>
              bucket(u) === filter &&
              (!needle ||
                u.name.toLowerCase().includes(needle) ||
                u.email.toLowerCase().includes(needle) ||
                u.role.toLowerCase().includes(needle) ||
                (u.team ?? "").toLowerCase().includes(needle)),
          );
          const selected = list.find((u) => u.id === selectedId) ?? matches[0] ?? null;

          return (
            <div className="grid flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
              {/* The list scrolls on its own and stays put while the detail scrolls. */}
              <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søk etter bruker"
                    placeholder="Søk på navn, e-post eller team" className="h-11 pl-9" />
                </div>
                <div role="radiogroup" aria-label="Vis" className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => (
                    <SelectableButton key={f.key} role="radio" selected={filter === f.key}
                      onClick={() => setFilter(f.key)} className="px-2.5 text-[13px]">
                      {f.label} <span className="tabular-nums text-muted-foreground">{counts[f.key]}</span>
                    </SelectableButton>
                  ))}
                </div>
                {matches.length === 0 ? (
                  <EmptyState
                    title={needle ? "Ingen treff" : filter === "inactive" ? "Ingen deaktiverte brukere" : "Ingen her"}
                    description={needle ? "Prøv et annet navn, en e-postadresse eller et team." : undefined}
                    mascot={mascotFor("empty").state}
                    className="py-6"
                  />
                ) : (
                  <ul aria-label="Brukere" className="-mx-1 flex max-h-[40dvh] flex-col gap-1 overflow-y-auto px-1 lg:max-h-none lg:flex-1">
                    {matches.map((u) => {
                      const isSel = selected?.id === u.id;
                      return (
                        <li key={u.id}>
                          <button type="button" onClick={() => setSelectedId(u.id)} aria-current={isSel ? "true" : undefined}
                            className={`flex min-h-11 w-full flex-col rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isSel ? "bg-[var(--ab-accent-9)]/10 ring-1 ring-inset ring-[var(--ab-accent-9)]/40" : "hover:bg-muted"}`}>
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[14px] text-foreground">{u.name}</span>
                              {(u.granted.length > 0 || u.revoked.length > 0) && (
                                <span className="shrink-0 text-[11px] text-muted-foreground">unntak</span>
                              )}
                            </span>
                            <span className="mt-0.5 truncate text-[12px] text-muted-foreground">
                              {u.role}{u.team ? ` · ${u.team}` : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>

              {selected ? (
                <QueryBoundary query={catalogue} skeleton={<Skeleton className="h-[28rem] rounded-xl" />}>
                  {(perms) => <UserDetail key={selected.id} user={selected} catalogue={perms} />}
                </QueryBoundary>
              ) : (
                <EmptyState title="Velg en bruker" description="Velg en person i listen for å se og endre tilgangene." />
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function UserDetail({ user, catalogue }: { user: UserAccess; catalogue: Permission[] }) {
  const setPermission = useSetPermission();
  const setActive = useSetUserActive();
  const setTemplate = useSetTemplate();
  const setModule = useSetModule();
  const templates = useAccessTemplates();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const busy = setPermission.isPending || setActive.isPending || setTemplate.isPending || setModule.isPending;
  const effective = new Set(effectivePermissions(user));
  const onError = (e: unknown) => setError(errorMessage(e));
  const ask = (p: Pending) => { setError(null); setPending(p); };

  const [nextTemplate, setNextTemplate] = React.useState<string>(user.template ?? "");
  const exceptions = catalogue.filter((p) => {
    const prov = provenanceOf(user, p.key);
    return prov === "granted" || prov === "revoked";
  });

  return (
    <section aria-label={`Tilganger for ${user.name}`} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      {/* Who, and the template — the main action on this screen. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-foreground">{user.name}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {user.email}{user.team ? ` · ${user.team}` : ""}
            {user.mfa && <> · <ShieldAlert className="inline size-3.5 align-[-2px]" aria-hidden /> krever tofaktor</>}
          </p>
          {!user.active && <p className="mt-1 text-[13px] font-medium text-danger">Kontoen er deaktivert</p>}
        </div>
        <Button variant="outline" className="min-h-11 gap-1.5 sm:min-h-9" disabled={busy}
          onClick={() => ask({
            title: user.active ? `Deaktiver ${user.name}?` : `Aktiver ${user.name}?`,
            body: user.active
              ? "Personen mister all tilgang med en gang. Malen og unntakene beholdes, så en aktivering gir alt tilbake."
              : "Personen får tilbake malen og unntakene som står under.",
            run: (reason) => setActive.mutate({ id: user.id, active: !user.active, reason }, { onError }),
          })}>
          {user.active ? <UserX className="size-4" aria-hidden /> : <UserCheck className="size-4" aria-hidden />}
          {user.active ? "Deaktiver" : "Aktiver"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label htmlFor="mal">Mal</Label>
          {IS_MOCK ? (
            <p id="mal" className="text-[15px] font-medium text-foreground">{user.role}</p>
          ) : (
            <select id="mal" value={nextTemplate} disabled={busy || !user.active}
              onChange={(e) => setNextTemplate(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Ingen mal (bare unntak)</option>
              {(templates.data ?? []).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          )}
        </div>
        {!IS_MOCK && (
          <Button className="min-h-11" disabled={busy || !user.active || nextTemplate === (user.template ?? "")}
            onClick={() => {
              const label = templates.data?.find((t) => t.key === nextTemplate)?.label ?? "ingen mal";
              ask({
                title: `Endre mal for ${user.name} til «${label}»?`,
                body: "Modulene under følger den nye malen. Unntakene du har gitt eller fjernet, beholdes.",
                run: (reason) => setTemplate.mutate({ id: user.id, template: nextTemplate || null, reason }, { onError }),
              });
            }}>
            Endre mal
          </Button>
        )}
      </div>

      {pending && (
        <ReasonPrompt {...pending} pending={busy} onCancel={() => setPending(null)}
          onConfirm={(reason) => { pending.run(reason); setPending(null); }} />
      )}
      {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}

      {exceptions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-foreground">Unntak fra malen</h3>
          <ul className="flex flex-col gap-1.5">
            {exceptions.map((p) => {
              const prov = provenanceOf(user, p.key);
              return (
                <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="min-w-0 text-[13.5px] text-foreground">
                    <ProvenanceChip provenance={prov} /> {p.label}
                    {user.reasons[p.key] && <span className="block text-[12.5px] text-muted-foreground">«{user.reasons[p.key]}»</span>}
                  </span>
                  <Button variant="ghost" className="min-h-11 sm:min-h-8" disabled={busy || !user.active}
                    onClick={() => ask({
                      title: `Fjern unntaket «${p.label}»?`, body: "Malen gjelder igjen for denne tilgangen.",
                      run: (reason) => setPermission.mutate({ id: user.id, permission: p.key, action: "reset", reason }, { onError }),
                    })}>
                    Tilbake til malen
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-[13px] font-medium text-foreground">Moduler</h3>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {GROUPS.map((g) => {
            const keys = catalogue.filter((p) => g.modules.includes(moduleOf(p)));
            if (keys.length === 0) return null;
            return <ModuleRow key={g.title} title={g.title} keys={keys} user={user} effective={effective} busy={busy}
              onAsk={ask} onError={onError} setModule={setModule} setPermission={setPermission} />;
          })}
        </ul>
        <p className="text-[12px] text-muted-foreground">
          Alle endringer krever begrunnelse og står i revisjonsloggen. Handlinger merket med skjold krever tofaktor.
        </p>
      </div>
    </section>
  );
}

function ModuleRow({ title, keys, user, effective, busy, onAsk, onError, setModule, setPermission }: {
  title: string;
  keys: Permission[];
  user: UserAccess;
  effective: Set<string>;
  busy: boolean;
  onAsk: (p: Pending) => void;
  onError: (e: unknown) => void;
  setModule: ReturnType<typeof useSetModule>;
  setPermission: ReturnType<typeof useSetPermission>;
}) {
  const [open, setOpen] = React.useState(false);
  const reduced = useReducedMotion();
  const held = keys.filter((p) => effective.has(p.key));
  const on = held.length > 0;
  // Compared with the TEMPLATE, not with «all of the module» (design review round 2): a
  // module exactly as the template gives it is unremarkable; only a deviation stands out.
  const granted = keys.some((p) => provenanceOf(user, p.key) === "granted" && effective.has(p.key));
  const revoked = keys.some((p) => provenanceOf(user, p.key) === "revoked");
  const fromTemplate = keys.some((p) => user.roleDefaults.includes(p.key));
  const state =
    granted && revoked ? "Gitt og fjernet"
      : granted ? "Gitt"
        : revoked ? "Fjernet"
          : fromTemplate ? "Fra malen" : "Av";
  const panelId = `mod-${title.replace(/\W+/g, "-")}`;

  function toggle(next: boolean) {
    const grant: string[] = [], revoke: string[] = [], reset: string[] = [];
    for (const p of keys) {
      const prov = provenanceOf(user, p.key);
      if (next && !effective.has(p.key)) (prov === "revoked" ? reset : grant).push(p.key);
      if (!next && effective.has(p.key)) (prov === "granted" ? reset : revoke).push(p.key);
    }
    onAsk({
      title: next ? `Gi ${user.name} hele modulen «${title}»?` : `Fjern modulen «${title}» for ${user.name}?`,
      body: next ? "Alle handlingene i modulen gis til denne personen, utover malen."
        : "Personen mister alle handlingene i modulen. Malen endres ikke for andre.",
      run: (reason) => (IS_MOCK
        ? [...grant.map((k) => ["grant", k]), ...revoke.map((k) => ["revoke", k]), ...reset.map((k) => ["reset", k])]
            .forEach(([action, permission]) => setPermission.mutate({ id: user.id, permission, action: action as "grant", reason }, { onError }))
        : setModule.mutate({ id: user.id, grant, revoke, reset, reason }, { onError })),
    });
  }

  return (
    <li>
      <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
        <Switch checked={on} disabled={busy || !user.active} onCheckedChange={toggle}
          aria-label={`${title}: ${on ? "på" : "av"}`} />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={panelId}
          className="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="text-[14px] font-medium text-foreground">{title}</span>
          <span className="flex items-center gap-2">
            {state !== "Av" && <StateChip state={state} />}
            <span className="text-[12px] tabular-nums text-muted-foreground">{held.length} av {keys.length}</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
        </button>
      </div>
      {open && (
        <motion.ul id={panelId} initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }} className="flex flex-col gap-1 bg-muted/20 px-4 pb-3 pt-1">
          {keys.map((p) => {
            const prov = provenanceOf(user, p.key);
            const has = effective.has(p.key);
            return (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 text-[13.5px] text-foreground">
                  {p.label}
                  {p.sensitive && <ShieldAlert className="ml-1.5 inline size-3.5 align-[-2px] text-muted-foreground" aria-label="krever tofaktor" />}
                  {p.description && p.description !== p.label && (
                    <span className="block text-[12.5px] text-muted-foreground">{p.description}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {prov !== "none" && <ProvenanceChip provenance={prov} />}
                  <Switch checked={has} disabled={busy || !user.active}
                    aria-label={`${p.label}: ${has ? "på" : "av"}`}
                    onCheckedChange={(next) => onAsk({
                      title: next ? `Gi ${user.name} «${p.label}»?` : `Fjern «${p.label}» for ${user.name}?`,
                      body: next ? "Gjelder bare denne personen." : "Gjelder bare denne personen. Malen endres ikke.",
                      run: (reason) => setPermission.mutate({
                        id: user.id, permission: p.key, reason,
                        action: next ? (prov === "revoked" ? "reset" : "grant") : (prov === "granted" ? "reset" : "revoke"),
                      }, { onError }),
                    })} />
                </span>
              </li>
            );
          })}
        </motion.ul>
      )}
    </li>
  );
}

const PROV: Record<Exclude<Provenance, "none">, { label: string; cls: string }> = {
  role: { label: "Fra malen", cls: "border-border text-muted-foreground" },
  granted: { label: "Gitt", cls: "border-[var(--ab-accent-9)]/40 bg-[var(--ab-accent-9)]/10 text-foreground" },
  revoked: { label: "Fjernet", cls: "border-danger/35 bg-danger/10 text-danger" },
};

function ProvenanceChip({ provenance }: { provenance: Provenance }) {
  if (provenance === "none") return null;
  const p = PROV[provenance];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${p.cls}`}>{p.label}</span>;
}

function StateChip({ state }: { state: string }) {
  // Deviations are emphasised; «Fra malen» stays neutral and quiet.
  const deviation = state !== "Fra malen";
  const cls = state === "Fjernet" ? PROV.revoked.cls : state.startsWith("Gitt") ? PROV.granted.cls : PROV.role.cls;
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${deviation ? "font-medium" : ""} ${cls}`}>{state}</span>;
}

/** Nothing changes without a reason, so the reason is part of the control (FR-A-02). */
function ReasonPrompt({ title, body, pending, onCancel, onConfirm }: {
  title: string; body: string; pending: boolean; onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const reduced = useReducedMotion();
  const [reason, setReason] = React.useState("");
  const id = React.useId();
  return (
    <motion.div role="group" aria-label={title} initial={reduced ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }} onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="rounded-lg border border-[var(--ab-accent-9)]/40 bg-[var(--ab-accent-9)]/5 p-4">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>
      <Label htmlFor={id} className="mt-3 block">Begrunnelse <span className="text-muted-foreground">(påkrevd)</span></Label>
      <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
        placeholder="For eksempel: Vikar for Ole i uke 44" className="mt-1.5 min-h-16 text-sm" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="min-h-11 sm:min-h-9" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>
          {pending ? "Lagrer…" : "Lagre endringen"}
        </Button>
        <Button variant="ghost" className="min-h-11 sm:min-h-9" onClick={onCancel}>Avbryt</Button>
      </div>
    </motion.div>
  );
}
