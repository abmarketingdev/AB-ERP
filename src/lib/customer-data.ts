export interface CampaignReport {
  campaign: string;
  period: string;
  location: string;
  donorsAcquired: number;
  totalPaid: number;
  campaignCost: number | null; // null = definition not agreed yet
  trend: { label: string; value: number }[];
  byLocation: { label: string; value: number }[];
  correction?: { date: string; note: string };
  reportDate: string;
}

export const CUSTOMER_REPORT: CampaignReport = {
  campaign: "Høstkampanjen 2026",
  period: "August 2026",
  location: "Alle lokasjoner",
  donorsAcquired: 412,
  totalPaid: 289400,
  campaignCost: 68200,
  trend: [
    { label: "Uke 31", value: 88 },
    { label: "Uke 32", value: 102 },
    { label: "Uke 33", value: 95 },
    { label: "Uke 34", value: 127 },
  ],
  byLocation: [
    { label: "Bergen", value: 168 },
    { label: "Oslo", value: 141 },
    { label: "Trondheim", value: 61 },
    { label: "Stavanger", value: 42 },
  ],
  correction: { date: "18. aug 2026", note: "12 givere fra uke 33 ble flyttet til riktig kampanje etter kvalitetskontroll." },
  reportDate: "20. aug 2026",
};

export const FIGURE_DEFINITIONS = {
  donorsAcquired: {
    label: "Givere rekruttert",
    definition: "Antall nye givere med godkjent og aktiv avtale i valgt periode.",
    source: "AB Marketing kvalitetskontroll",
  },
  totalPaid: {
    label: "Totalt innbetalt",
    definition: "Sum innbetalt av rekrutterte givere i valgt periode, før eventuelle refusjoner.",
    source: "Betalingsleverandør",
  },
  campaignCost: {
    label: "Kampanjekostnad",
    definition: "Beregningen er ikke endelig avklart internt ennå og vises derfor ikke.",
    source: "—",
  },
} as const;
