"use client";

import * as React from "react";
import { UserCog } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeputy, useSetDeputy, useLeaders } from "@/lib/api/srs";
import { errorMessage } from "@/lib/api/client";

/**
 * GODK-04 — "Godkjenner kan ha stedfortreder ved fravær (ikke personsavhengig)."
 *
 * The parenthesis is the requirement, and it is the reason this has a date
 * window rather than a simple on/off: a deputy who never expires is a second
 * permanent approver, which is precisely the person-dependency the SRS is
 * trying to remove. The queue must survive one person being on holiday, not
 * acquire a shadow owner.
 */
const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });

export function DeputyCard() {
  const deputy = useDeputy();
  const setDeputy = useSetDeputy();
  const leaders = useLeaders();

  const [open, setOpen] = React.useState(false);
  const [who, setWho] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const active = deputy.data?.deputy;

  async function save() {
    setError(null);
    if (!who) { setError("Velg hvem som skal være stedfortreder."); return; }
    try {
      await setDeputy.mutateAsync({ deputy: who, from: from || undefined, to: to || undefined });
      setOpen(false);
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <UserCog className="size-4 text-muted-foreground" aria-hidden /> Stedfortreder
          </h2>
          {active ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-success/10 text-success">{active}</Badge>
              <Button size="sm" variant="ghost" disabled={setDeputy.isPending}
                onClick={() => setDeputy.mutate({ deputy: null })}>
                Fjern
              </Button>
            </div>
          ) : !open ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Sett stedfortreder</Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {active
            ? `${active} kan godkjenne på dine vegne${deputy.data?.from ? ` fra ${dayFmt.format(new Date(deputy.data.from))}` : ""}${deputy.data?.to ? ` til ${dayFmt.format(new Date(deputy.data.to))}` : ", inntil videre"}. Køen stopper ikke når du er borte.`
            : "Uten stedfortreder stopper godkjenningskøen når du er borte. Sett en periode, så utløper den av seg selv."}
        </p>

        {open && !active && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dep-who" className="text-xs text-muted-foreground">Hvem</Label>
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger id="dep-who" className="w-[13rem]" aria-label="Hvem"><SelectValue placeholder="Velg person" /></SelectTrigger>
                <SelectContent>
                  {(leaders.data ?? []).map((l) => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                  <SelectItem value="Nasrin Hassan">Nasrin Hassan (HR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dep-from" className="text-xs text-muted-foreground">Fra</Label>
              <Input id="dep-from" type="date" className="w-[10.5rem]" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dep-to" className="text-xs text-muted-foreground">Til</Label>
              <Input id="dep-to" type="date" className="w-[10.5rem]" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button size="sm" disabled={setDeputy.isPending} onClick={save}>Lagre</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
