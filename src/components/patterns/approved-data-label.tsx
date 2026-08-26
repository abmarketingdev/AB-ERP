import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ApprovedDataLabelProps {
  className?: string;
}

/**
 * FR-Q-06 — where a figure counts approved data only, the screen says so.
 *
 * A badge rather than a footnote, because the sentence has to be next to the
 * number it qualifies. Its tooltip carries FR-P-05's explanation: this is why
 * the count is lower than the one you remember.
 */
export function ApprovedDataLabel({ className }: ApprovedDataLabelProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success ${className ?? ""}`}
        >
          <BadgeCheck className="size-3.5" />
          Godkjent data
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Kun godkjente salg telles. Tall kan avvike fra rådata inntil kvalitetskontroll er fullført.
      </TooltipContent>
    </Tooltip>
  );
}

interface CorrectionNoticeProps {
  date: string;
  reason?: string;
}

export function CorrectionNotice({ date, reason }: CorrectionNoticeProps) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-on-tint">
      <span className="font-medium">Korrigert {date}.</span>{" "}
      {reason ?? "Tallene er oppdatert etter en kvalitetskorrigering."}
    </div>
  );
}
