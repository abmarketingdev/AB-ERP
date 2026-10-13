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

/** ONB-03 — sendt, åpnet, signert. Three states, not a boolean. */
export const contractStatusSchema = z.enum(["ikke-sendt", "sendt", "apnet", "signert"]);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  "ikke-sendt": "Ikke sendt",
  sendt: "Sendt",
  apnet: "Åpnet",
  signert: "Signert",
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
});
export type Equipment = z.infer<typeof equipmentSchema>;

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
  checklist: z.array(z.object({ key: checklistKeySchema, done: z.boolean(), at: z.string().nullable() })),
  contract: z.object({
    status: contractStatusSchema,
    /** ONB-04 — the Scrive template id the contract was sent from. */
    templateId: z.string().nullable(),
    sentAt: z.string().nullable(),
    signedAt: z.string().nullable(),
    /** ONB-03 — purring on contracts that are not signed. */
    remindersSent: z.number(),
  }),
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
  firstDayNoShow: z.object({ at: z.string(), followedUpBy: z.string(), note: z.string() }).nullable(),
  completedAt: z.string().nullable(),
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
  accessTemplate: z.enum(ACCESS_TEMPLATES),
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
