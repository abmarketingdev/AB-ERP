"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLog } from "@/lib/api/quality";

export default function AdminRevisjonslogg() {
  const now = new Date();
  const query = useAuditLog();

  const [actor, setActor] = React.useState("alle");
  const [area, setArea] = React.useState("alle");
  const [actionType, setActionType] = React.useState("alle");
  const [person, setPerson] = React.useState("");
  // FR-A-07 names date explicitly. Entries carry a Norwegian display stamp
  // ("21. aug 2026, 08:12"), so the filter parses that rather than pretending
  // there is an ISO field to compare — the log is read by people, and its
  // timestamps are formatted for them.
  const [day, setDay] = React.useState("alle");

  const activeFilterCount =
    [actor, area, actionType, day].filter((v) => v !== "alle").length + (person.trim() ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <QueryBoundary
        query={query}
        skeleton={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        }
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen oppføringer i revisjonsloggen"
      >
        {(log) => {
          const actors = Array.from(new Set(log.map((a) => a.actor)));
          const areas = Array.from(new Set(log.map((a) => a.area)));
          const actionTypes = Array.from(new Set(log.map((a) => a.action)));
          const days = Array.from(new Set(log.map((a) => a.at.split(",")[0].trim())));

          const filtered = log.filter((a) => {
            if (actor !== "alle" && a.actor !== actor) return false;
            if (area !== "alle" && a.area !== area) return false;
            if (actionType !== "alle" && a.action !== actionType) return false;
            if (person.trim() && !a.affected.toLowerCase().includes(person.trim().toLowerCase())) return false;
            if (day !== "alle" && a.at.split(",")[0].trim() !== day) return false;
            return true;
          });

          return (
            <div className="flex flex-1 flex-col gap-6">
              <PageHeader
                title="Revisjonslogg"
                description={`${filtered.length} av ${log.length} oppføringer — korrigeringer, tilgangsendringer, forhåndsvisninger og eksporter i ett spor`}
                source="Revisjonslogg"
                lastUpdated={now}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  aria-label="Søk i revisjonsloggen etter berørt person"
                  placeholder="Søk etter berørt person…"
                  className="w-56"
                />
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger className="w-40" aria-label="Dato"><SelectValue placeholder="Dato" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle datoer</SelectItem>
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={actor} onValueChange={setActor}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Aktør" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle aktører</SelectItem>
                    {actors.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Handlingstype" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle handlinger</SelectItem>
                    {actionTypes.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Område" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle områder</SelectItem>
                    {areas.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      setActor("alle");
                      setArea("alle");
                      setActionType("alle");
                      setDay("alle");
                      setPerson("");
                    }}
                  >
                    Nullstill filtre ({activeFilterCount})
                  </Button>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState title="Ingen oppføringer matcher filtrene" roy="sleeping" />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    {/* Named where a screen reader meets it. The count is part
                        of the name because the filters change it, and "which
                        entries am I looking at" is the question the log is for. */}
                    <caption className="sr-only">
                      Revisjonslogg — {filtered.length} oppføringer med gjeldende filtre
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tidspunkt</TableHead>
                        <TableHead>Aktør</TableHead>
                        <TableHead>Handling</TableHead>
                        <TableHead>Område</TableHead>
                        <TableHead>Berørt</TableHead>
                        <TableHead>Før → Etter</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{a.at}</TableCell>
                          <TableCell className="text-sm font-medium">{a.actor}</TableCell>
                          <TableCell className="text-sm">{a.action}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.area}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.affected}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {a.before || a.after ? (
                              <span>
                                <span className="text-danger line-through">{a.before}</span> → <span className="text-success">{a.after}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
