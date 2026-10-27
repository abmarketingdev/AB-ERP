"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCandidates, useCreateCandidate, useStages } from "@/lib/api/recruitment";
import { errorMessage } from "@/lib/api/client";
import { newCandidateSchema, type NewCandidate } from "@/types/recruitment";
import { CandidateBoard } from "@/components/patterns/candidate-board";

/**
 * FR-R-01 / FR-R-04 / FR-R-09 — the candidate list.
 *
 * FR-R-01: a candidate is created with name, contact, source, date and owner,
 * and owner defaults to whoever is creating it rather than an empty select
 * nobody fills in. FR-R-04: filtered by status, owner, source and campaign —
 * the four questions a recruiter actually asks. FR-R-09 is enforced at the
 * endpoint, not here: candidate data is personal data about people who have not
 * been hired, so the route guard and the API both refuse without the
 * recruitment permission.
 */
export default function RekrutteringKandidater() {
  const now = new Date();
  const stages = useStages();
  const candidates = useCandidates();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("alle");
  const [source, setSource] = React.useState("alle");
  const [campaign, setCampaign] = React.useState("alle");
  const [owner, setOwner] = React.useState("alle");
  const [createOpen, setCreateOpen] = React.useState(false);

  const all = React.useMemo(() => candidates.data ?? [], [candidates.data]);
  const stageOptions = stages.data ?? [];
  const sources = React.useMemo(() => Array.from(new Set(all.map((c) => c.source))), [all]);
  const campaigns = React.useMemo(() => Array.from(new Set(all.map((c) => c.campaign))), [all]);
  const owners = React.useMemo(() => Array.from(new Set(all.map((c) => c.owner))), [all]);

  const filtered = all.filter((c) => {
    if (status !== "alle" && c.stageId !== status) return false;
    if (source !== "alle" && c.source !== source) return false;
    if (campaign !== "alle" && c.campaign !== campaign) return false;
    if (owner !== "alle" && c.owner !== owner) return false;
    if (query.trim() && !c.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const activeFilterCount = [status, source, campaign, owner].filter((v) => v !== "alle").length + (query.trim() ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Kandidater"
        description={`${filtered.length} av ${all.length} kandidater`}
        source="Rekrutteringslogg"
        lastUpdated={now}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Ny kandidat
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Søk etter kandidat"
            placeholder="Søk etter navn…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle statuser</SelectItem>
              {stageOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Eier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle eiere</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Kilde" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle kilder</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Kampanje" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle kampanjer</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setStatus("alle");
                setSource("alle");
                setCampaign("alle");
                setOwner("alle");
                setQuery("");
              }}
            >
              Nullstill filtre ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      <QueryBoundary
        query={stages}
        skeleton={<Skeleton className="h-40 rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen steg er definert"
      >
        {(stageList) => (
          <QueryBoundary
            query={candidates}
            skeleton={<Skeleton className="h-40 rounded-lg" />}
            isEmpty={() => filtered.length === 0}
            emptyTitle="Ingen kandidater matcher filtrene"
            emptyDescription="Prøv å justere eller nullstille filtrene."
          >
            {() => <CandidateBoard stages={stageList} candidates={filtered} />}
          </QueryBoundary>
        )}
      </QueryBoundary>

      <NewCandidateDialog open={createOpen} onOpenChange={setCreateOpen} sources={sources} campaigns={campaigns} />
    </div>
  );
}

type FieldErrors = Partial<Record<keyof NewCandidate, string>>;

function NewCandidateDialog({
  open,
  onOpenChange,
  sources,
  campaigns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: string[];
  campaigns: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny kandidat</DialogTitle>
          <DialogDescription>Navn, kontakt, kilde og dato registreres. Eier settes til deg.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form starts blank on every opening. */}
        <NewCandidateForm sources={sources} campaigns={campaigns} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewCandidateForm({
  sources,
  campaigns,
  onClose,
}: {
  sources: string[];
  campaigns: string[];
  onClose: () => void;
}) {
  const create = useCreateCandidate();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [source, setSource] = React.useState(sources[0] ?? "");
  const [campaign, setCampaign] = React.useState(campaigns[0] ?? "");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [failed, setFailed] = React.useState<string | null>(null);

  function submit() {
    setFailed(null);
    const parsed = newCandidateSchema.safeParse({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      source,
      campaign,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof NewCandidate | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => onClose(),
      onError: (err) => setFailed(errorMessage(err)),
    });
  }

  return (
    <>
      <div className="space-y-4">
        {failed && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{failed}</p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Navn</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fornavn Etternavn" autoFocus />
          {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Telefon</Label>
            <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+47…" />
            {errors.phone && <p className="text-xs text-danger">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">E-post</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@epost.no" />
            {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Kilde</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.source && <p className="text-xs text-danger">{errors.source}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Kampanje</Label>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.campaign && <p className="text-xs text-danger">{errors.campaign}</p>}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Avbryt</Button>
        <Button disabled={create.isPending} onClick={submit}>
          {create.isPending ? "Lagrer…" : "Opprett kandidat"}
        </Button>
      </DialogFooter>
    </>
  );
}
