/**
 * Demo-kundekontoer for kundeportalen (bare mock-bygg). Flyttet ut av lib/mock-data.ts, som også
 * lastes i api-bygg via lib/recruitment.ts, slik at demo-kontoene ikke havner i produksjonsbundelen.
 */
import type { CustomerAccount, CustomerAgreement } from "@/types/quality";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * FR-A-03 — customer accounts and their portal logins.
 *
 * Røde Kors and Strømmestiftelsen match the working demo logins in
 * `customer-session.tsx`, so the accounts an administrator sees here are the
 * ones that actually sign in — including the agreement, which the portal reads
 * back out of this same record. Leger Uten Grenser shows the state before a
 * login exists at all.
 */
/**
 * Three accounts on three deliberately different agreements (FR-C-07).
 *
 * The differences are the point. Røde Kors negotiated the full economics and
 * aggregate fieldwork; Strømmestiftelsen buys the headline result only, monthly,
 * with no view of the work behind it. If both saw the same screen the agreement
 * would be decoration, and the requirement asks for the opposite.
 *
 * `DEFAULT_AGREEMENT` is what a newly created account gets: the two figures
 * nobody argues about, and nothing else. A new customer is entitled to less
 * until somebody decides otherwise, not more until somebody notices.
 */
export const DEFAULT_AGREEMENT: CustomerAgreement = {
  figures: ["donorsAcquired", "totalPaid"],
  fieldworkDetail: "none",
  granularities: ["month", "year"],
  organisations: [],
  costDefinitionAgreed: false,
};

export const CUSTOMER_ACCOUNTS: CustomerAccount[] = [
  {
    id: "ca1", organisation: "Røde Kors", orgNumber: "864 138 442", contactName: "Ingrid Haug",
    email: "kontakt@rodekors.no", campaigns: ["Høstkampanjen 2026", "Vårkampanjen 2026"],
    provisioned: true, provisionedAt: "2. jun 2026", provisionedBy: "Admin Bruker",
    lastLogin: "20. aug 2026, 11:24", createdAt: "28. mai 2026",
    credentialsSentTo: "kontakt@rodekors.no", credentialsSentAt: "2. jun 2026, 09:12",
    agreement: {
      figures: ["donorsAcquired", "totalPaid", "averageMonthlyGift", "retention90", "campaignCost", "costPerDonor"],
      fieldworkDetail: "aggregate",
      granularities: ["week", "month", "year"],
      organisations: ["Røde Kors Hordaland", "Røde Kors Oslo", "Røde Kors Trøndelag"],
      costDefinitionAgreed: false,
    },
  },
  {
    id: "ca2", organisation: "Strømmestiftelsen", orgNumber: "952 002 139", contactName: "Bjarte Nes",
    email: "rapport@strommestiftelsen.no", campaigns: ["Strømmestiftelsen"],
    provisioned: true, provisionedAt: "14. jul 2026", provisionedBy: "Admin Bruker",
    lastLogin: null, createdAt: "12. jul 2026",
    credentialsSentTo: "rapport@strommestiftelsen.no", credentialsSentAt: "14. jul 2026, 15:40",
    agreement: {
      figures: ["donorsAcquired", "totalPaid", "averageMonthlyGift"],
      fieldworkDetail: "none",
      granularities: ["month", "year"],
      organisations: [],
      costDefinitionAgreed: false,
    },
  },
  {
    id: "ca3", organisation: "Leger Uten Grenser", orgNumber: "977 076 235", contactName: "Sofia Ratkovic",
    email: "norge@legerutengrenser.no", campaigns: ["Leger Uten Grenser"],
    provisioned: false, provisionedAt: null, provisionedBy: null, lastLogin: null,
    createdAt: "18. aug 2026", credentialsSentTo: null, credentialsSentAt: null,
    agreement: clone(DEFAULT_AGREEMENT),
  },
];
