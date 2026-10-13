import { z } from "zod";

/**
 * BOOK-01 … BOOK-09 — intervjubooking.
 *
 * The SRS is explicit that the point is fewer no-shows, which makes the
 * *messages* part of the feature rather than a side effect: BOOK-03 names SMS,
 * BOOK-04 e-mail, BOOK-05 a reminder with a cancellation link, and BOOK-06 says
 * cancelling must update the calendar and tell both people. So every message
 * this flow would send is modelled and rendered, not merely logged — a demo
 * that says "an SMS was sent" proves nothing about what it said.
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

export const messageSchema = z.object({
  id: z.string(),
  channel: z.enum(["sms", "epost"]),
  to: z.string(),
  recipientRole: z.enum(["kandidat", "leder"]),
  kind: z.enum(["bekreftelse", "paaminnelse", "avlysning", "ombooking"]),
  sentAt: z.string(),
  /** The actual text. BOOK-03 lists what it must contain. */
  body: z.string(),
});
export type InterviewMessage = z.infer<typeof messageSchema>;

export const interviewSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  candidateName: z.string(),
  candidatePhone: z.string(),
  leader: z.string(),
  /** ISO. Start of the slot; interviews are a fixed 30 minutes here. */
  startsAt: z.string(),
  location: z.string(),
  status: interviewStatusSchema,
  /** BOOK-02 — the id the calendar gave back, so a cancel can delete it. */
  calendarEventId: z.string().nullable(),
  /** BOOK-05/06 — the token in the cancellation link. Public, unguessable. */
  cancelToken: z.string(),
  /** BOOK-08 — filled in after the interview, by the leader. */
  attended: z.boolean().nullable(),
  assessment: z.string().nullable(),
  /** BOOK-05 — the reminder can be switched off per booking. */
  reminderEnabled: z.boolean(),
  messages: z.array(messageSchema),
  bookedBy: z.string(),
  bookedAt: z.string(),
});
export type Interview = z.infer<typeof interviewSchema>;
export const interviewListSchema = z.array(interviewSchema);

/** BOOK-01 — a leader's free slots, as the booking screen needs them. */
export const slotSchema = z.object({
  startsAt: z.string(),
  available: z.boolean(),
  /** Why it is not available, when it is not. Never an unexplained gap. */
  reason: z.string().nullable(),
});
export type Slot = z.infer<typeof slotSchema>;
export const slotListSchema = z.array(slotSchema);

export const bookInterviewSchema = z.object({
  candidateId: z.string().min(1, "Velg kandidat"),
  leader: z.string().min(1, "Velg leder"),
  startsAt: z.string().min(1, "Velg tidspunkt"),
  location: z.string().min(1, "Skriv inn sted"),
  reminderEnabled: z.boolean(),
});
export type BookInterview = z.infer<typeof bookInterviewSchema>;

/** The public cancel/rebook page needs just enough to show what it is cancelling. */
export const publicInterviewSchema = z.object({
  id: z.string(),
  candidateName: z.string(),
  leader: z.string(),
  startsAt: z.string(),
  location: z.string(),
  status: interviewStatusSchema,
  /** Alternatives offered on the rebook path (BOOK-07). */
  alternatives: z.array(z.string()),
});
export type PublicInterview = z.infer<typeof publicInterviewSchema>;
