"use client";

import { ReportScreen } from "./report-screen";
import { useKundeReport } from "@/lib/kundeportal/api";

export function KundeReport() {
  return <ReportScreen useReport={useKundeReport} />;
}
