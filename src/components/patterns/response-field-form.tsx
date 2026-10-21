"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/patterns/date-picker";
import { SelectableButton } from "@/components/patterns/selectable-button";
import type { ResponseField } from "@/types/task";

/**
 * OPPG-01 «Hver oppgave har svarfelt, som i Asana» — one control per declared
 * field (text, number, choice, date, yes/no). The server validates the same
 * schema; `errors` shows its per-field answer inline. A task without declared
 * fields has one required text field, «Svar», on both sides.
 */
export const DEFAULT_FIELDS: ResponseField[] = [{ key: "svar", label: "Svar", type: "text", required: true }];

export function ResponseFieldForm({
  idPrefix, fields, values, onChange, errors,
}: {
  idPrefix: string;
  fields: ResponseField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
}) {
  const list = fields.length ? fields : DEFAULT_FIELDS;
  return (
    <div className="flex flex-col gap-3">
      {list.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const err = errors?.[f.key];
        const v = values[f.key];
        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={id} id={`${id}-label`}>
              {f.label}{f.required ? "" : <span className="text-muted-foreground"> (valgfritt)</span>}
            </Label>
            {f.type === "text" && (
              <Textarea id={id} rows={f.key === "svar" || f.key === "vurdering" ? 3 : 2} value={(v as string) ?? ""}
                aria-invalid={Boolean(err)} onChange={(e) => onChange(f.key, e.target.value)} />
            )}
            {f.type === "number" && (
              <Input id={id} type="number" inputMode="numeric" className="w-32" min={f.min} max={f.max}
                value={v === undefined || v === null ? "" : String(v)} aria-invalid={Boolean(err)}
                onChange={(e) => onChange(f.key, e.target.value === "" ? null : Number(e.target.value))} />
            )}
            {f.type === "date" && (
              <DatePicker id={id} value={(v as string) ?? ""} onChange={(x) => onChange(f.key, x)} />
            )}
            {f.type === "choice" && (f.options ?? []).length <= 4 && (
              <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
                {(f.options ?? []).map((o) => (
                  <SelectableButton key={o} type="button" role="radio" selected={v === o} onClick={() => onChange(f.key, o)}>{o}</SelectableButton>
                ))}
              </div>
            )}
            {f.type === "choice" && (f.options ?? []).length > 4 && (
              <Select value={(v as string) ?? ""} onValueChange={(x) => onChange(f.key, x)}>
                <SelectTrigger id={id} className="w-56" aria-invalid={Boolean(err)}><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {f.type === "bool" && (
              <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex gap-2">
                <SelectableButton type="button" role="radio" selected={v === true} onClick={() => onChange(f.key, true)}>Ja</SelectableButton>
                <SelectableButton type="button" role="radio" selected={v === false} onClick={() => onChange(f.key, false)}>Nei</SelectableButton>
              </div>
            )}
            {err && <p className="text-xs text-danger">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** The answer as recorded, label: value, for the closed card. */
export function ResponseSummary({ fields, response }: { fields: ResponseField[]; response: { key: string; value: unknown }[] }) {
  const label = (k: string) => (fields.length ? fields : DEFAULT_FIELDS).find((f) => f.key === k)?.label ?? k;
  const show = (v: unknown) => (v === true ? "Ja" : v === false ? "Nei" : String(v));
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/40 p-3 text-sm">
      {response.map((r) => (
        <React.Fragment key={r.key}>
          <dt className="text-muted-foreground">{label(r.key)}</dt>
          <dd className="whitespace-pre-wrap">{show(r.value)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
