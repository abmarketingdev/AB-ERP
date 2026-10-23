"use client";

import * as React from "react";
import { Share2, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAudienceExport } from "@/lib/api/srs";
import { errorMessage } from "@/lib/api/client";

/**
 * LEAD-11 — eksporter gode kandidater som målgruppe til Meta og TikTok.
 *
 * The export is the easy half. The half worth building carefully is LEAD-10:
 * only people who ticked the *second* consent box are included, and the result
 * says how many were left out for that reason. An export that quietly drops a
 * third of the list is one nobody can check, and this is the kind of processing
 * a works council asks about by name.
 */
const num = new Intl.NumberFormat("nb-NO");
const PLATFORM_LABEL: Record<string, string> = { meta: "Meta", tiktok: "TikTok" };

export function AudienceExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const run = useAudienceExport();
  const [platform, setPlatform] = React.useState<"Meta" | "TikTok">("Meta");
  const [basis, setBasis] = React.useState<"hired" | "qualified">("hired");
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof run.mutateAsync>> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) { setResult(null); setError(null); } }, [open]);

  async function go() {
    setError(null);
    try { setResult(await run.mutateAsync({ platform, basis })); }
    catch (err) { setError(errorMessage(err)); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Eksporter målgruppe</DialogTitle>
          <DialogDescription>
            Send gode kandidater til Meta eller TikTok som utgangspunkt for lookalike-annonser.
            Bare personer som har samtykket til nettopp dette blir med.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              {num.format(result.exported)} personer sendt til {PLATFORM_LABEL[result.platform.toLowerCase()] ?? result.platform}.
              {" "}De blir målgruppen som annonseplattformen finner lignende personer ut fra.
            </p>
            <dl className="flex flex-col gap-1 text-sm">
              <Row label="Vurdert" value={num.format(result.considered)} />
              <Row label="Eksportert" value={num.format(result.exported)} />
              <Row label="Utelatt — manglet samtykke" value={num.format(result.excludedNoConsent)} />
            </dl>
            <p className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Bare hashet e-post og telefon (SHA-256) forlater systemet, aldri navn eller notater.
                {result.sample[0]?.hashedEmail && <> Eksempel: <code className="break-all font-mono">{result.sample[0].hashedEmail}</code></>}
              </span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-platform">Plattform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as "Meta")}>
                <SelectTrigger id="aud-platform" aria-label="Plattform"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meta">Meta (Facebook og Instagram)</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-basis">Hvem skal med</Label>
              <Select value={basis} onValueChange={(v) => setBasis(v as "hired")}>
                <SelectTrigger id="aud-basis" aria-label="Hvem skal med"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hired">De som ble ansatt</SelectItem>
                  <SelectItem value="qualified">Alle som ble sendt til rekruttering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{result ? "Lukk" : "Avbryt"}</Button>
          {!result && (
            <Button className="gap-1.5" disabled={run.isPending} onClick={go}>
              <Share2 className="size-4" /> {run.isPending ? "Eksporterer…" : `Eksporter til ${platform}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
