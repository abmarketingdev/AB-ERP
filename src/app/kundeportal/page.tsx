import type { Metadata } from "next";
import { CustomerPortalUnavailable } from "@/components/patterns/customer-portal-unavailable";

export const metadata: Metadata = { title: "Kundeportal" };

/** Målet for omdirigeringen av /kunde/* i api-bygg (next.config.ts) til den ekte portalen finnes. */
export default function KundeportalPage() {
  return <CustomerPortalUnavailable />;
}
