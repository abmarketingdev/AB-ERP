"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmStep } from "@/components/patterns/confirm-step";
import { DatePicker, DateRangePicker } from "@/components/patterns/date-picker";
import { FormErrorSummary } from "@/components/patterns/form-error-summary";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { SelectableButton } from "@/components/patterns/selectable-button";
import { StaleNotice } from "@/components/patterns/query-boundary";
import { Label } from "@/components/ui/label";

/**
 * Living reference for the shared patterns (A1). Peers check behaviour here before using a
 * pattern, and the design review screenshots it in both themes. Not linked from any menu.
 */
export default function Monstre() {
  const [date, setDate] = React.useState("2026-10-21");
  const [dt, setDt] = React.useState("");
  const [slot, setSlot] = React.useState("10:00");
  const [chips, setChips] = React.useState<string[]>(["Finn"]);
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState({ from: "2026-10-12", to: "2026-10-21" });
  const [small, setSmall] = React.useState("");
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 bg-background px-4 py-10 text-foreground">
      <h1 className="text-2xl font-medium">Felles mønstre</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">DatePicker</h2>
        <div className="space-y-1.5">
          <Label htmlFor="dp-1">Oppfølgingsdato</Label>
          <DatePicker id="dp-1" value={date} onChange={setDate} min="2026-10-01" />
          <p className="text-sm text-muted-foreground">Verdi: <code>{date || "(tom)"}</code></p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dp-2">Frist (dato og klokkeslett)</Label>
          <DatePicker id="dp-2" value={dt} onChange={setDt} withTime />
          <p className="text-sm text-muted-foreground">Verdi: <code>{dt || "(tom)"}</code></p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Filterrad (size=&quot;sm&quot;, 36 px)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Kanal" className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option>Alle kanaler</option></select>
          <DatePicker id="dp-sm" size="sm" value={small} onChange={setSmall} aria-label="Dato" />
          <DateRangePicker id="dr-sm" size="sm" from={range.from} to={range.to} onChange={setRange} aria-label="Periode" />
        </div>
        <p className="text-sm text-muted-foreground">Periode: <code>{range.from || "–"} → {range.to || "–"}</code></p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">SelectableButton</h2>
        <div role="radiogroup" aria-label="Tidspunkt" className="flex flex-wrap gap-2">
          {["09:00", "10:00", "11:30", "13:00"].map((s) => (
            <SelectableButton key={s} role="radio" selected={slot === s} onClick={() => setSlot(s)}>kl. {s}</SelectableButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Finn", "NAV", "Indeed", "Nettsiden"].map((c) => (
            <SelectableButton key={c} selected={chips.includes(c)}
              onClick={() => setChips(chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c])}>{c}</SelectableButton>
          ))}
          <SelectableButton selected={false} disabled>Deaktivert</SelectableButton>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">QueryBoundary: delvis/utdatert</h2>
        <p className="text-sm text-muted-foreground">Når en bakgrunnshenting feiler, beholdes dataene og dette merket vises over dem. Feilboks bare når det ikke finnes data.</p>
        <StaleNotice updatedAt={new Date().setHours(18, 42, 0, 0)} onRetry={() => undefined} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">ConfirmStep</h2>
        <ConfirmStep trigger="Slett personopplysninger" confirmLabel="Slett for godt" typeToConfirm="SLETT"
          consequence="Navn, telefon, e-post, notater og vedlegg slettes i alle deler av systemet. Kan ikke angres."
          onConfirm={() => undefined} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">FormErrorSummary</h2>
        <FormErrorSummary errors={[{ field: "dp-1", message: "Oppfølgingsdato må fylles ut." }, { message: "Begrunnelse må fylles ut." }]} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">ResponsiveSheet</h2>
        <Button onClick={() => setOpen(true)}>Åpne skjema</Button>
        <ResponsiveSheet open={open} onOpenChange={setOpen} title="Gi tilgang" description="Gjelder bare denne personen."
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button><Button onClick={() => setOpen(false)}>Lagre</Button></>}>
          <div className="space-y-3">
            {Array.from({ length: 14 }, (_, i) => <p key={i} className="text-sm text-muted-foreground">Langt innhold rad {i + 1} — dialogen skal aldri klippe, men rulle innvendig.</p>)}
          </div>
        </ResponsiveSheet>
      </section>
    </main>
  );
}
