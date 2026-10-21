import { z } from "zod";

/**
 * ONB-01 … ONB-09 — onboarding, and the employee record it produces.
 *
 * ONB-09 says the employee is created in HR "med riktig tilgangsmal" when
 * onboarding completes, so onboarding is not a checklist that happens to end —
 * it is the thing that creates the employee. The two types live in the same
 * file because that transition is the point.
 */

export const checklistKeySchema = z.enum([
  "personalia", "kontrakt", "bilde", "utstyr", "opplaering", "forstedag",
]);
export type ChecklistKey = z.infer<typeof checklistKeySchema>;

export const CHECKLIST_LABEL: Record<ChecklistKey, string> = {
  personalia: "Personalia",
  kontrakt: "Kontrakt signert",
  bilde: "Bilde",
  utstyr: "Utstyr utlevert",
  opplaering: "Opplæring",
  forstedag: "Første arbeidsdag",
};

/** ONB-03 — sendt, åpnet, signert. Three states, not a boolean — plus the two ends a
 *  signing can also reach (avvist by the signer, utløpt in Scrive). */
export const contractStatusSchema = z.enum(["ikke-sendt", "sendt", "apnet", "signert", "avvist", "utlopt"]);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  "ikke-sendt": "Ikke sendt",
  sendt: "Sendt",
  apnet: "Åpnet",
  signert: "Signert",
  avvist: "Avvist",
  utlopt: "Utløpt",
};

/**
 * ONB-07 — utstyr med serienummer, og en egen utstyrskontrakt som signeres
 * *etter* utlevering.
 *
 * The serial number is required at hand-over rather than optional, because the
 * equipment contract is what the employee signs to confirm receipt, and a
 * contract that says "one phone" confirms nothing.
 */
export const equipmentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  model: z.string(),
  serial: z.string(),
  handedOutAt: z.string(),
  handedOutBy: z.string(),
  /** Receipt status of the hand-out line in HR's register (api mode). */
  signatureStatus: z.string().nullable().optional(),
});
export type Equipment = z.infer<typeof equipmentSchema>;

export const contractSchema = z.object({
  id: z.string().optional(),
  kind: z.string().optional(),
  /** The name HR and Scrive use: «Ansettelseskontrakt», «Prosjektavtale». */
  label: z.string().optional(),
  /** What Ole reads instead of a Scrive id: «Prosjektavtale – Norsk Folkehjelp, junior». */
  templateName: z.string().nullable().optional(),
  status: contractStatusSchema,
  /** ONB-04 — the Scrive template id the contract was sent from. */
  templateId: z.string().nullable(),
  sentAt: z.string().nullable(),
  /** ONB-03 «åpnet» — first time the signer opened it in Scrive. */
  seenAt: z.string().nullable().default(null),
  signedAt: z.string().nullable(),
  /** ONB-03 — purring on contracts that are not signed. */
  remindersSent: z.number(),
});
export type Contract = z.infer<typeof contractSchema>;

export const timelineEntrySchema = z.object({
  at: z.string(),
  kind: z.string(),
  actor: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const newHireSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  campaign: z.string(),
  team: z.string(),
  startDate: z.string(),
  /** ONB-01 — who registered the data, per the SRS: salgsleder. */
  registeredBy: z.string(),
  checklist: z.array(z.object({
    key: checklistKeySchema, done: z.boolean(), at: z.string().nullable(),
    /** ONB-05 — `system` items follow their source (Scrive, utstyrsregisteret, opplæring,
     *  lederkalenderen); only `manual` ones are ticked by a person. */
    source: z.enum(["system", "manual"]).default("system"),
    manual: z.boolean().default(false),
  })),
  contract: contractSchema,
  /** Every onboarding contract HR sent (ansettelse + prosjekt, …), each with its own timeline. */
  contracts: z.array(contractSchema).default([]),
  /** ONB-06 — Ole takes the photo and attaches it to the person. */
  photo: z.object({ uploadedAt: z.string(), uploadedBy: z.string() }).nullable(),
  equipment: z.array(equipmentSchema),
  /** ONB-07 — the equipment contract, separate from the employment one. */
  equipmentContract: z.object({
    status: contractStatusSchema,
    sentAt: z.string().nullable(),
    signedAt: z.string().nullable(),
  }),
  /** ONB-08 — did not turn up on day one, after being followed up. */
  firstDayNoShow: z.object({ at: z.string().nullable(), followedUpBy: z.string(), note: z.string() }).nullable(),
  completedAt: z.string().nullable(),
  status: z.enum(["pending_handover", "in_progress", "ready", "completed", "no_show", "cancelled"]).default("in_progress"),
  /** ONB-03 «kan ikke starte før kontrakten er signert» — why the person is not cleared yet. */
  blockedReasons: z.array(z.object({ code: z.string(), label: z.string() })).default([]),
  /** HR is the source; when it cannot be reached the screen shows its last copy, marked stale. */
  hrSync: z.object({ state: z.enum(["pending", "ok", "failed"]), at: z.string().nullable(), error: z.string().nullable() })
    .nullable().default(null),
  timeline: z.array(timelineEntrySchema).default([]),
  accessTemplate: z.string().default(""),
  positionLevel: z.string().default("junior"),
  /** Leader levels need a manager account, made by HR by hand (one account = one role). */
  manualAccount: z.boolean().default(false),
  authUserId: z.string().nullable().default(null),
});
export type NewHire = z.infer<typeof newHireSchema>;
export const newHireListSchema = z.array(newHireSchema);

/**
 * The employee register the SRS assumed the ERP would hold (§2.2).
 *
 * There is no ERP, so it is here. Kept deliberately thin: this is a recruitment
 * and onboarding portal, and an employee record that grows payroll fields is a
 * second product hiding inside this one.
 */
export const ACCESS_TEMPLATES = ["Promotør", "Leder", "Rekrutterer", "Godkjenner", "Ledelse", "Administrator"] as const;
export type AccessTemplate = (typeof ACCESS_TEMPLATES)[number];

export const employeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  team: z.string(),
  campaign: z.string(),
  role: z.string(),
  startDate: z.string(),
  active: z.boolean(),
  /** ONB-09 — the access template applied when onboarding completed. */
  accessTemplate: z.string(),
  equipment: z.array(equipmentSchema),
  photo: z.boolean(),
  /** Which onboarding produced this person, so the trail is followable. */
  fromNewHireId: z.string().nullable(),
});
export type Employee = z.infer<typeof employeeSchema>;
export const employeeListSchema = z.array(employeeSchema);

export const handOutEquipmentSchema = z.object({
  kind: z.string().min(1, "Velg utstyrstype"),
  model: z.string().min(1, "Skriv inn modell"),
  serial: z.string().min(3, "Serienummer er påkrevd"),
});
export type HandOutEquipment = z.infer<typeof handOutEquipmentSchema>;

export const EQUIPMENT_KINDS = ["Mobiltelefon", "Nettbrett", "Jakke", "ID-kort", "Powerbank", "Bil"];
