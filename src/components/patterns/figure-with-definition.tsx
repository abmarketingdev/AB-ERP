import * as React from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FigureWithDefinitionProps {
  label: string;
  value: React.ReactNode;
  definition: string;
  source: string;
  reportDate: string;
  /** The definition's version, so two reports can be compared honestly. */
  version?: string;
  locked?: boolean;
  lockedReason?: string;
}

/** Every customer-facing number is reachable-in-one-interaction from its
 * definition, source, and report date (FR-C-05). */
export function FigureWithDefinition({ label, value, definition, source, reportDate, version, locked, lockedReason }: FigureWithDefinitionProps) {
  return (
    <Card>
      <CardContent className="space-y-1.5 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-print-hide
                className="flex min-h-11 min-w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6 sm:min-w-6"
                aria-label={`Definisjon av ${label}`}
              >
                <Info className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-2 text-sm">
              <p className="font-medium text-foreground">{label}</p>
              <p className="text-muted-foreground">{definition}</p>
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                <p>Kilde: {source}</p>
                <p>Rapportdato: {reportDate}</p>
                {version && <p>Definisjon: {version}</p>}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {locked ? (
          <div className="py-1">
            <p className="text-sm text-muted-foreground">{lockedReason}</p>
          </div>
        ) : (
          <p className="text-3xl font-medium tabular-nums text-foreground">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
