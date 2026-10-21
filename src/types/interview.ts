import { z } from "zod";

/**
 * BOOK-01 … BOOK-09 — intervjubooking.
 *
 * The SRS is explicit that the point is fewer no-shows, which makes the
 * *messages* part of the feature rather than a side effect: BOOK-03 names SMS,
 * BOOK-04 e-mail, BOOK-05 a reminder with a cancellation link, and BOOK-06 says
 * cancelling must update the calendar and tell both people. So every message
 * this flow sends is listed with its text and delivery status — a demo that
 * says "an SMS was sent" proves nothing about what it said or whether it arrived.
 */

export const interviewStatusSchema = z.enum([
  "booket", "gjennomfort", "avlyst", "no-show", "ombooket",
]);
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  booket: "Booket",
  gjennomfort: "Gjennomført",
  avlyst: "Avlyst",
  "no-show": "Ikke møtt",
  ombooket: "Ombooket",
};

/** A leader is identified by id; two leaders can share a name. */
export const leaderRefSchema = z.object({ id: z.string(), name: z.string() });
export type LeaderRef = z.infer<typeof leaderRefSchema>;

export const leaderSchema = leaderRefSchema.extend({ teams: z.array(z.string()) });
export type Leader = z.infer<typeof leaderSchema>;
export const leaderListSchema = z.array(leaderSchema);

export const messageStatusSchema = z.enum(["queued", "blocked_optout", "sent", "delivered", "failed", "cancelled"]);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  queued: "I kø",
  blocked_optout: "Ikke sendt – avmeldt",
  sent: "Sendt",
  delivered: "Levert",
  failed: "Feilet",
  cancelled: "Avbrutt",
};

export const messageSchema = z.object({
  id: z.string(),
  channel: z.enum(["sms", "epost"]),
  to: z.string(),
  recipientRole: z.enum(["kandidat", "leder", "rekrutterer"]),
  kind: z.enum(["bekreftelse", "paaminnelse", "avlysning", "ombooking", "kansellering-kvittering"]),
  sentAt: z.string(),
  /** Quiet hours (21–08): the SMS waits until this time. */
  sendAfter: z.string().nullable(),
  status: messageStatusSchema,
  error: z.string(),
  subject: z.string(),
  /** The actual text. BOOK-03 lists what it must contain. */
  body: z.string(),
}).loose();
export type InterviewMessage = z.infer<typeof messageSchema>;

export const calendarStateSchema = z.enum(["venter", "synket", "feilet", "avlyst"]);
export type CalendarState = z.infer<typeof calendarStateSchema>;

export const CALENDAR_STATE_LABEL: Record<CalendarState, string> = {
  venter: "Invitasjon sendes",
  synket: "I kalenderen",
  feilet: "Invitasjon ikke sendt",
  avlyst: "Fjernet fra kalenderen",
};

export const interviewSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  candidateName: z.string(),
  candidatePhone: z.string(),
  candidateStatus: z.string(),
  leader: leaderRefSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  status: interviewStatusSchema,
  /** BOOK-02 — the id the calendar gave back, so a move or cancel finds it. */
  calendarEventId: z.string(),
  calendarState: calendarStateSchema,
  /** BOOK-05 — the reminder can be switched off per booking. */
  reminderEnabled: z.boolean(),
  reminderSentAt: z.string().nullable(),
  /** BOOK-08 — filled in after the interview, by the leader. */
  attended: z.boolean().nullable(),
  assessment: z.string(),
  rating: z.number().nullable(),
  recommend: z.boolean().nullable(),
  outcomeAt: z.string().nullable(),
  bookedBy: z.string(),
  bookedAt: z.string(),
  cancelledAt: z.string().nullable(),
  cancelledBy: z.enum(["", "kandidat", "rekrutterer", "leder", "admin"]),
  /** BOOK-07 — the booking that replaced this one. */
  rebookedTo: z.string().nullable(),
  messages: z.array(messageSchema),
});
export type Interview = z.infer<typeof interviewSchema>;
export const interviewListSchema = z.array(interviewSchema);

/** BOOK-01 — a leader's slots. Every unavailable one says why. */
export const slotSchema = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
  available: z.boolean(),
  reason: z.string().nullable(),
});
export type Slot = z.infer<typeof slotSchema>;

export const slotsResponseSchema = z.object({
  /** «kalender» once the leader's calendar has answered; «erklært» = declared hours only. */
  source: z.enum(["kalender", "erklært"]),
  /** The calendar could not be read just now: show what we have, say so. */
  stale: z.boolean(),
  computedAt: z.string(),
  calendarSyncedAt: z.string().nullable(),
  slots: z.array(slotSchema),
});
export type SlotsResponse = z.infer<typeof slotsResponseSchema>;

export const bookInterviewSchema = z.object({
  candidateId: z.string().min(1, "Velg kandidat"),
  leaderId: z.string().min(1, "Velg leder"),
  startsAt: z.string().min(1, "Velg tidspunkt"),
  location: z.string().min(1, "Skriv inn sted"),
  reminderEnabled: z.boolean(),
});
export type BookInterview = z.infer<typeof bookInterviewSchema>;

/** BOOK-08 — one submission: attendance and assessment are answered together. */
export const outcomeSchema = z.object({
  attended: z.boolean(),
  assessment: z.string().trim().min(3, "Skriv en kort vurdering"),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  recommend: z.boolean().nullable().optional(),
});
export type Outcome = z.infer<typeof outcomeSchema>;

/** The public cancel/rebook page needs just enough to show what it is changing. */
export const publicInterviewSchema = z.object({
  id: z.string(),
  candidateName: z.string(),
  leader: z.string(),
  startsAt: z.string(),
  location: z.string(),
  status: z.enum(["booket", "gjennomfort", "avlyst", "no-show", "ombooket", "passert"]),
  canChange: z.boolean(),
  /** Free slots offered on the rebook path (BOOK-07), spread over days. */
  alternatives: z.array(z.string()),
  /** BOOK-03 «kontaktinformasjon»: who to ask. */
  contact: z.object({ name: z.string(), phone: z.string() }),
});
export type PublicInterview = z.infer<typeof publicInterviewSchema>;
