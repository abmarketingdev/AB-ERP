"use client";

import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationPreview } from "@/lib/api/srs";

/**
 * BEM-05 og OPPG-03 — automatisk varsling på Slack.
 *
 * Both are "Bør" in the SRS, and both are the same mechanism: a message the
 * system writes and Slack delivers. Showing the text rather than a "sent" tick
 * is the same decision as for the interview SMS — the wording is the part
 * somebody can object to *before* it starts going out to real people, and a
 * message that reads as an accusation will quietly cost more than the feature
 * is worth.
 */
export function SlackPreview({ kind }: { kind: "absence" | "tasks" }) {
  const preview = useNotificationPreview();
  const rows = kind === "absence" ? preview.data?.absence : preview.data?.leaderSummary;

  if (preview.isPending) return <Skeleton className="h-28 w-full rounded-lg" />;
  if (!rows || rows.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
            {kind === "absence" ? "Påminnelser som sendes på Slack" : "Varsel om forfalte oppgaver"}
          </h2>
          <Badge variant="outline" className="text-[10px]">forhåndsvisning</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {kind === "absence"
            ? "Ansatte som ligger bak planlagt oppmøte får denne meldingen automatisk. Du får et sammendrag."
            : "Ledere med forfalte oppgaver varsles automatisk."}
        </p>
        <ul className="flex flex-col gap-2">
          {rows.map((m, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] uppercase">{m.channel}</Badge>
                <span className="font-mono">{m.to}</span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
