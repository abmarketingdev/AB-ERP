"use client";

import * as React from "react";
import { Search, Package, Camera } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees } from "@/lib/api/onboarding";
import { ACCESS_TEMPLATES } from "@/types/onboarding";

/**
 * Ansattregisteret — det §2.2 forutsatte at ERP-en holdt.
 *
 * There is no ERP, so the portal holds it. Deliberately thin: this is a
 * recruitment and onboarding product, and an employee record that grows salary
 * and absence fields is a second product hiding inside this one. What is here
 * is what the SRS actually needs — who exists, which team, which access
 * template (ONB-09), and what equipment they are holding (ONB-07).
 */

const ALL = "alle";
const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" });

export default function Ansatte() {
  const employees = useEmployees();
  const [q, setQ] = React.useState("");
  const [team, setTeam] = React.useState(ALL);
  const [template, setTemplate] = React.useState(ALL);
  const [active, setActive] = React.useState("aktive");

  const all = employees.data ?? [];
  const teams = React.useMemo(() => [...new Set(all.map((e) => e.team))].sort(), [all]);

  const rows = all.filter((e) => {
    if (active === "aktive" && !e.active) return false;
    if (active === "sluttet" && e.active) return false;
    if (team !== ALL && e.team !== team) return false;
    if (template !== ALL && e.accessTemplate !== template) return false;
    if (q.trim() && !`${e.name} ${e.email}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  const withEquipment = rows.filter((e) => e.equipment.length > 0).length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Ansatte"
        description={`${rows.length} av ${all.length} ansatte · ${withEquipment} har utstyr utlevert`}
        source="HR-systemet (ansatte fra onboarding og eldre ansatte)"
        lastUpdated={new Date()}
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9"
            placeholder="Søk på navn eller e-post" aria-label="Søk i ansattregisteret" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Filter id="emp-team" label="Team" value={team} onChange={setTeam} options={teams} />
          <Filter id="emp-tpl" label="Tilgangsmal" value={template} onChange={setTemplate} options={[...ACCESS_TEMPLATES]} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-active" className="text-xs text-muted-foreground">Status</Label>
            <Select value={active} onValueChange={setActive}>
              <SelectTrigger id="emp-active" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aktive">Aktive</SelectItem>
                <SelectItem value="sluttet">Sluttet</SelectItem>
                <SelectItem value={ALL}>Alle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <QueryBoundary
        query={employees}
        skeleton={<Skeleton className="h-96 w-full rounded-lg" />}
        isEmpty={() => rows.length === 0}
        emptyTitle="Ingen ansatte matcher filteret"
        emptyDescription="Prøv å fjerne et filter."
      >
        {() => (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Kampanje</TableHead>
                    <TableHead>Startet</TableHead>
                    <TableHead>Tilgangsmal</TableHead>
                    <TableHead className="text-right">Utstyr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {e.name}
                          {e.photo && <Camera className="size-3 text-muted-foreground" aria-label="Har bilde" />}
                          {!e.active && <Badge variant="outline" className="text-[10px]">sluttet</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{e.email}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.role}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.team}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.campaign}</TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {/* Most HR employees predate the recruitment flow and have no start date. */}
                        {e.startDate ? dayFmt.format(new Date(e.startDate)) : "—"}
                      </TableCell>
                      <TableCell>
                        {e.accessTemplate ? <Badge variant="outline">{e.accessTemplate}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.equipment.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
                            title={e.equipment.map((q) => `${q.kind} ${q.serial}`).join("\n")}
                          >
                            <Package className="size-3" aria-hidden />
                            {e.equipment.length}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}

function Filter({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="alle">Alle</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
