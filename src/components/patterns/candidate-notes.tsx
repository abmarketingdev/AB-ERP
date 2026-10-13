"use client";

import * as React from "react";
import { Lock, Paperclip, Plus, Phone, MessageSquare, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddNote, useAddAttachment } from "@/lib/api/srs";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/permissions";
import type { Candidate } from "@/types/recruitment";

/**
 * KAND-06 og KAND-09 — notater, private notater og vedlegg.
 *
 * The private note is the interesting one. §8.1 makes it an acceptance
 * criterion — "Private notater vises bare for brukerne som er valgt" — and the
 * honest way to hold that is for the filtering to happen before the data
 * reaches the browser. The server already drops notes the caller may not see;
 * this component additionally never *offers* to write one unless the person
 * holds the permission, so the control does not exist for people whose note
 * would be visible to nobody including themselves.
 */

const KIND_LABEL: Record<string, string> = {
  cv: "CV", soknad: "Søknad", attest: "Attest", bilde: "Bilde", annet: "Annet",
};

export function CandidateNotes({ candidate }: { candidate: Candidate }) {
  const session = useSession();
  const addNote = useAddNote();
  const addFile = useAddAttachment();
  const canSeePrivate = Boolean(session?.permissions.includes("privatenotes.view"));

  const [body, setBody] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [fileName, setFileName] = React.useState("");
  const [fileKind, setFileKind] = React.useState("cv");
  const [fileOpen, setFileOpen] = React.useState(false);

  const visible = candidate.notes.filter(
    (n) => n.visibleTo.length === 0 || n.visibleTo.some((p) => session?.permissions.includes(p)),
  );
  const hiddenCount = candidate.notes.length - visible.length;

  async function submitNote() {
    setError(null);
    if (!body.trim()) { setError("Skriv et notat."); return; }
    try {
      await addNote.mutateAsync({
        id: candidate.id,
        body: body.trim(),
        visibleTo: isPrivate ? ["privatenotes.view"] : [],
        author: session?.name,
      });
      setBody(""); setIsPrivate(false);
    } catch (err) { setError(errorMessage(err)); }
  }

  async function submitFile() {
    setError(null);
    if (!fileName.trim()) { setError("Skriv et filnavn."); return; }
    try {
      await addFile.mutateAsync({ id: candidate.id, name: fileName.trim(), kind: fileKind });
      setFileName(""); setFileOpen(false);
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KAND-08 — ring eller send melding direkte fra kandidatkortet. */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <span className="mr-2 text-sm text-muted-foreground">Ta kontakt</span>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`tel:${candidate.phone.replace(/\s/g, "")}`}>
              <Phone className="size-3.5" aria-hidden /> Ring {candidate.phone}
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`sms:${candidate.phone.replace(/\s/g, "")}`}>
              <MessageSquare className="size-3.5" aria-hidden /> Send SMS
            </a>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <a href={`mailto:${candidate.email}`}>
              <FileText className="size-3.5" aria-hidden /> {candidate.email}
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Notater</h2>
            {hiddenCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                {hiddenCount} privat{hiddenCount === 1 ? "" : "e"} notat{hiddenCount === 1 ? "" : "er"} er skjult for deg
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen notater ennå.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((n) => {
                const priv = n.visibleTo.length > 0;
                return (
                  <li key={n.id}
                      className={`rounded-lg border p-3 ${priv ? "border-warning/40 bg-warning/5" : "border-border"}`}>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{n.author}</span>
                      <span className="tabular-nums">{n.at}</span>
                      {priv && (
                        <Badge className="gap-1 bg-warning/10 text-[10px] text-warning-on-tint">
                          <Lock className="size-2.5" aria-hidden /> Privat — kun HR og ledelse
                        </Badge>
                      )}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{n.body}</p>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label htmlFor="note-body" className="text-xs text-muted-foreground">Nytt notat</Label>
            <Textarea id="note-body" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              {canSeePrivate && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={isPrivate} onCheckedChange={(v) => setIsPrivate(Boolean(v))} />
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5 text-muted-foreground" aria-hidden />
                    Privat — kun synlig for HR og ledelse
                  </span>
                </label>
              )}
              <Button size="sm" className="ml-auto gap-1.5" disabled={addNote.isPending} onClick={submitNote}>
                <Plus className="size-4" /> Legg til
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Paperclip className="size-4 text-muted-foreground" aria-hidden /> Vedlegg
            </h2>
            {!fileOpen && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFileOpen(true)}>
                <Plus className="size-4" /> Legg til vedlegg
              </Button>
            )}
          </div>

          {candidate.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen vedlegg.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {candidate.attachments.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{f.name}</span>
                  <Badge variant="outline" className="text-[10px]">{KIND_LABEL[f.kind] ?? f.kind}</Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">{f.sizeKb} kB</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {f.uploadedBy} · {f.uploadedAt}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {fileOpen && (
            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="file-name" className="text-xs text-muted-foreground">Filnavn</Label>
                <Input id="file-name" value={fileName} placeholder="CV - Navn Navnesen.pdf"
                  onChange={(e) => setFileName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file-kind" className="text-xs text-muted-foreground">Type</Label>
                <Select value={fileKind} onValueChange={setFileKind}>
                  <SelectTrigger id="file-kind" className="w-[9rem]" aria-label="Type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={addFile.isPending} onClick={submitFile}>Last opp</Button>
              <Button size="sm" variant="ghost" onClick={() => setFileOpen(false)}>Avbryt</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
