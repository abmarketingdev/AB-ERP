import { RECRUITMENT_STAGES } from "./mock-data";

export function stageById(id: string) {
  return RECRUITMENT_STAGES.find((s) => s.id === id);
}

export function stageIndex(id: string) {
  return RECRUITMENT_STAGES.findIndex((s) => s.id === id);
}

export const STAGE_BADGE: Record<string, string> = {
  ny: "bg-muted text-muted-foreground",
  screening: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  intervju: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  referanse: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  tilbud: "bg-warning/10 text-warning-on-tint",
  ansatt: "bg-success/10 text-success",
  avsluttet: "bg-muted text-muted-foreground line-through",
};

export const CONTRACT_LABEL = {
  "not-sent": "Ikke sendt",
  sent: "Sendt",
  signed: "Signert",
} as const;

export const CONTRACT_BADGE = {
  "not-sent": "bg-muted text-muted-foreground",
  sent: "bg-warning/10 text-warning-on-tint",
  signed: "bg-success/10 text-success",
} as const;
