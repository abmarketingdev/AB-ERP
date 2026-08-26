import * as React from "react";
import { Roy, type RoyState } from "./roy";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  roy?: RoyState | false;
  className?: string;
}

export function EmptyState({ title, description, action, roy = "sleeping", className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center ${className ?? ""}`}>
      {roy !== false && <Roy state={roy} size={56} />}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
