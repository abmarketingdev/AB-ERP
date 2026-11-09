"use client";

import { ReportScreen } from "@/components/kundeportal/report-screen";
import { useCustomerReport } from "@/lib/api/quality";

/** Demo (mock-bygg): samme rapport-UI som den ekte portalen, data fra mock-API-et. */
export default function KundeRapport() {
  return <ReportScreen useReport={useCustomerReport} />;
}
