import * as React from "react";
import { Mascot, type MascotState, type MascotPose } from "./mascot";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  mascot?: MascotState | false;
  /** Name a pose directly when no semantic state fits the emptiness. */
  pose?: MascotPose;
  className?: string;
}

export function EmptyState({ title, description, action, mascot = "sleeping", pose, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center ${className ?? ""}`}>
      {mascot !== false && <Mascot state={mascot} pose={pose} size={56} />}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
