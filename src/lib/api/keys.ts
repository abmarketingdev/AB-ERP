/**
 * Query key convention: [domain, scope, subject, ...params].
 *
 * Consistent keys are what make invalidation after a correction a one-liner
 * instead of a hunt. Anything that can change when a correction commits must be
 * reachable from `qk.afterCorrection()`.
 */
export const qk = {
  promoter: {
    kpis: (granularity: string = "week") => ["promoter", "me", "kpis", granularity] as const,
    weekPlan: () => ["promoter", "me", "weekplan"] as const,
    goal: () => ["promoter", "me", "goal"] as const,
    courses: () => ["promoter", "me", "courses"] as const,
    news: () => ["promoter", "me", "news"] as const,
  },
  leader: {
    kpis: () => ["leader", "team", "kpis"] as const,
    trend: () => ["leader", "team", "trend"] as const,
    members: () => ["leader", "team", "members"] as const,
    goal: () => ["leader", "team", "goal"] as const,
    followUps: () => ["leader", "team", "followups"] as const,
    measures: () => ["leader", "team", "measures"] as const,
    courses: () => ["leader", "team", "courses"] as const,
    goalPlan: () => ["leader", "team", "goal-plan"] as const,
    orgGoalPlan: () => ["leader", "org", "goal-plan"] as const,
    teams: () => ["leader", "org", "teams"] as const,
  },
  leads: {
    /** The filter is part of the key — paging and filtering are server-side. */
    list: (filter: Record<string, string | number> = {}) => ["leads", "inbox", "list", filter] as const,
    counts: () => ["leads", "inbox", "counts"] as const,
    lead: (id: string) => ["leads", "inbox", "lead", id] as const,
    /** Everything the inbox shows, for invalidation after a bulk action. */
    all: () => ["leads"] as const,
  },
  recruitment: {
    stages: () => ["recruitment", "all", "stages"] as const,
    candidates: () => ["recruitment", "mine", "candidates"] as const,
    candidate: (id: string) => ["recruitment", "mine", "candidate", id] as const,
  },
  customer: {
    /** The filter is part of the key — a different filter is a different report. */
    report: (filter?: Record<string, string>) =>
      ["customer", "self", "report", filter ?? {}] as const,
  },
  quality: {
    definitions: () => ["quality", "all", "definitions"] as const,
    corrections: () => ["quality", "all", "corrections"] as const,
    notices: () => ["quality", "all", "notices"] as const,
    audit: () => ["quality", "all", "audit"] as const,
    importRuns: () => ["quality", "all", "import-runs"] as const,
    rejectedRows: () => ["quality", "all", "rejected-rows"] as const,
    access: () => ["quality", "all", "access"] as const,
    permissions: () => ["quality", "all", "permissions"] as const,
    customers: () => ["quality", "all", "customers"] as const,
    orgOverview: () => ["quality", "all", "org-overview"] as const,
  },
  /** Everything a committed correction can move. */
  afterCorrection: () => [
    ["promoter"],
    ["leader"],
    ["customer"],
    ["quality"],
  ],
} as const;
