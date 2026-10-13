"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Minus, Plus, RotateCcw, Search, ShieldAlert, UserX, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUserAccess,
  usePermissionCatalogue,
  useSetPermission,
  useSetUserActive,
} from "@/lib/api/quality";
import { errorMessage } from "@/lib/api/client";
import {
  effectivePermissions,
  provenanceOf,
  actionsFor,
  PROVENANCE_LABEL,
  type Provenance,
} from "@/lib/access";
import type { Permission, UserAccess } from "@/types/quality";

/**
 * FR-A-02 / FR-S-04 — the access surface.
 *
 * Doc 01 calls this "the new architectural surface", and the reason is the
 * model: access is user-specific, not role-based. A role is a *starting point*,
 * and everything after it is an individual decision someone made and should
 * have to justify.
 *
 * So the screen never shows a flat list of what someone can do. It shows, for
 * every permission, **where it came from** — role default, granted by hand, or
 * revoked by hand — because only the last two are anyone's to change, and an
 * administrator who cannot tell them apart will eventually remove access that
 * the job requires and wonder why.
 *
 * Every change takes a mandatory reason and writes an audit entry with the
 * effective set before and after. An access grant with no recorded why is the
 * hardest thing to unpick six months later, and this log is what an audit reads.
 */
export default function AdminTilganger() {
  const now = new Date();
  const users = useUserAccess();
  const catalogue = usePermissionCatalogue();
  const setPermission = useSetPermission();
  const setActive = useSetUserActive();

  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Tilganger"
        description="Rolledefault, individuelle tillegg og fjerninger — og hvem som bestemte hva"
        source="Tilgangsstyring"
        lastUpdated={now}
      />

      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {failed}
        </p>
      )}

      <QueryBoundary
        query={users}
        skeleton={<Skeleton className="h-96 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen brukere"
        className="flex flex-1 flex-col gap-4"
      >
        {(list) => {
          const needle = q.trim().toLowerCase();
          const matches = needle
            ? list.filter(
                (u) =>
                  u.name.toLowerCase().includes(needle) ||
                  u.email.toLowerCase().includes(needle) ||
                  u.role.toLowerCase().includes(needle) ||
                  (u.team ?? "").toLowerCase().includes(needle),
              )
            : list;
          const selected = matches.find((u) => u.id === selectedId) ?? matches[0] ?? null;

          return (
            <>
              <div className="relative max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Søk etter bruker"
                  placeholder="Søk etter navn, e-post, rolle eller team…"
                  className="pl-9"
                />
              </div>

              {matches.length === 0 ? (
                <EmptyState
                  title="Ingen brukere matcher søket"
                  description="Prøv et navn, en e-postadresse eller et teamnavn."
                  mascot="thinking"
                />
              ) : (
                <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
                  {/* List left, detail right — the same shape as KPI-ordbok, because
                      it is the same job: pick a record, inspect its provenance. */}
                  <ul
                    className="flex max-h-[70vh] flex-col gap-1.5 self-start overflow-y-auto rounded-xl border border-border bg-card p-2"
                    aria-label="Brukere"
                  >
                    {matches.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(u.id)}
                          aria-pressed={selected?.id === u.id}
                          className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected?.id === u.id
                              ? "bg-[var(--ab-accent-9)]/12 ring-1 ring-[var(--ab-accent-9)]/30"
                              : "hover:bg-secondary/60"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-[13.5px] ${u.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                            >
                              {u.name}
                            </span>
                            {(u.granted.length > 0 || u.revoked.length > 0) && (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-[var(--ab-accent-9)]"
                                title="Har individuelle endringer"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground">
                            {u.role}
                            {u.team && ` · ${u.team}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {selected && (
                    <QueryBoundary
                      query={catalogue}
                      skeleton={<Skeleton className="h-96 rounded-xl" />}
                    >
                      {(perms) => (
                        <UserDetail
                          key={selected.id}
                          user={selected}
                          catalogue={perms}
                          pending={setPermission.isPending || setActive.isPending}
                          onChange={(permission, action, reason) => {
                            setFailed(null);
                            setPermission.mutate(
                              { id: selected.id, permission, action, reason },
                              { onError: (e) => setFailed(errorMessage(e)) },
                            );
                          }}
                          onToggleActive={(active, reason) => {
                            setFailed(null);
                            setActive.mutate(
                              { id: selected.id, active, reason },
                              { onError: (e) => setFailed(errorMessage(e)) },
                            );
                          }}
                        />
                      )}
                    </QueryBoundary>
                  )}
                </div>
              )}

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Effektiv tilgang = rollens standardsett + individuelle tillegg − individuelle
                fjerninger · alle endringer krever begrunnelse og logges i revisjonsloggen
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function UserDetail({
  user,
  catalogue,
  pending,
  onChange,
  onToggleActive,
}: {
  user: UserAccess;
  catalogue: Permission[];
  pending: boolean;
  onChange: (permission: string, action: "grant" | "revoke" | "reset", reason: string) => void;
  onToggleActive: (active: boolean, reason: string) => void;
}) {
  const effective = effectivePermissions(user);
  const [editing, setEditing] = React.useState<
    { permission: string; action: "grant" | "revoke" | "reset"; label: string } | null
  >(null);
  const [deactivating, setDeactivating] = React.useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[16px] text-foreground">{user.name}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {user.email} · {user.role}
            {user.team && ` · ${user.team}`}
            {user.mfa && " · 2FA påkrevd"}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {user.active ? `Sist pålogget ${user.lastSeen ?? "ukjent"}` : "Kontoen er deaktivert"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setDeactivating(true)}
          disabled={pending}
        >
          {user.active ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
          {user.active ? "Deaktiver" : "Aktiver"}
        </Button>
      </div>

      {deactivating && (
        <ReasonPrompt
          title={user.active ? `Deaktiver ${user.name}?` : `Aktiver ${user.name}?`}
          body={
            user.active
              ? "Brukeren mister all tilgang umiddelbart. Kontoen beholdes for revisjonssporet."
              : "Brukeren får tilbake den effektive tilgangen som står nedenfor."
          }
          pending={pending}
          onCancel={() => setDeactivating(false)}
          onConfirm={(reason) => {
            onToggleActive(!user.active, reason);
            setDeactivating(false);
          }}
        />
      )}

      {/* The effective set, stated once and plainly — this is what the person
          can actually do right now. */}
      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
          Effektiv tilgang
        </p>
        <p className="mt-1.5 text-[13px] text-foreground">
          {!user.active
            ? "Ingen — kontoen er deaktivert."
            : effective.length === 0
              ? "Ingen tilganger."
              : catalogue
                  .filter((p) => effective.includes(p.key))
                  .map((p) => p.label)
                  .join(", ")}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {catalogue.map((p) => {
          const prov = provenanceOf(user, p.key);
          const can = actionsFor(prov);
          const isOpen = editing?.permission === p.key;

          return (
            <li key={p.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-foreground">
                    {p.label}
                    {p.sensitive && (
                      <span className="inline-flex items-center gap-1 rounded border border-warning/30 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-warning">
                        <ShieldAlert className="size-3" aria-hidden />
                        Sensitiv
                      </span>
                    )}
                    <ProvenanceChip provenance={prov} />
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{p.description}</p>
                  {user.reasons[p.key] && (
                    <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                      <span className="font-mono text-[10px] uppercase tracking-[0.09em]">
                        Begrunnelse
                      </span>{" "}
                      {user.reasons[p.key]}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {can.grant && (
                    <Action
                      icon={Plus}
                      label="Gi"
                      disabled={pending || !user.active}
                      onClick={() =>
                        setEditing({ permission: p.key, action: "grant", label: p.label })
                      }
                    />
                  )}
                  {can.revoke && (
                    <Action
                      icon={Minus}
                      label="Fjern"
                      disabled={pending || !user.active}
                      onClick={() =>
                        setEditing({ permission: p.key, action: "revoke", label: p.label })
                      }
                    />
                  )}
                  {can.reset && (
                    <Action
                      icon={RotateCcw}
                      label="Tilbakestill"
                      disabled={pending || !user.active}
                      onClick={() =>
                        setEditing({ permission: p.key, action: "reset", label: p.label })
                      }
                    />
                  )}
                </div>
              </div>

              {isOpen && editing && (
                <ReasonPrompt
                  className="mt-3"
                  title={
                    editing.action === "grant"
                      ? `Gi ${user.name} tilgang til ${editing.label}?`
                      : editing.action === "revoke"
                        ? `Fjern ${editing.label} for ${user.name}?`
                        : `Tilbakestill ${editing.label} til rollens standard?`
                  }
                  body={
                    editing.action === "revoke" && prov === "role"
                      ? "Tilgangen følger rollen. Den fjernes bare for denne brukeren, og rollen endres ikke."
                      : editing.action === "reset"
                        ? "Den individuelle endringen fjernes, og rollens standard gjelder igjen."
                        : "Tilgangen gis bare til denne brukeren, utover rollens standard."
                  }
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onConfirm={(reason) => {
                    onChange(editing.permission, editing.action, reason);
                    setEditing(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProvenanceChip({ provenance }: { provenance: Provenance }) {
  const tone: Record<Provenance, string> = {
    role: "border-border text-muted-foreground",
    granted: "border-[var(--ab-accent-9)]/35 bg-[var(--ab-accent-9)]/10 text-[var(--ab-accent-11)]",
    revoked: "border-danger/30 bg-danger/10 text-danger",
    none: "border-border text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide ${tone[provenance]}`}
    >
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
}

function Action({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button size="sm" variant="outline" className="gap-1.5" disabled={disabled} onClick={onClick}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}

/** Nothing changes without a reason, so the reason is part of the control. */
function ReasonPrompt({
  title,
  body,
  pending,
  className,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  pending: boolean;
  className?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const reduced = useReducedMotion();
  const [reason, setReason] = React.useState("");

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={className}
    >
      <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3.5">
        <p className="text-[13.5px] text-foreground">{title}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{body}</p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Begrunnelse (påkrevd)"
          aria-label="Begrunnelse"
          className="mt-2.5 min-h-16 text-sm"
          autoFocus
        />
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>
            {pending ? "Lagrer…" : "Bekreft"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Avbryt
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
