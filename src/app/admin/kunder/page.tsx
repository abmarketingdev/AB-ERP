import dynamic from "next/dynamic";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { AdminKunder } from "@/components/kundeportal/admin-kunder";

/*
 * Mock-bygg: demoen. Api-bygg (produksjon): ekte kundekontoer (hr-service via recruitment,
 * tilgangsnøkkel customers.admin). Byggetidsvilkår per fil — se src/app/kunde/layout.tsx.
 */
const DEMO = process.env.NEXT_PUBLIC_DATA_SOURCE !== "api" && process.env.NEXT_PUBLIC_API_MOCKING !== "disabled";
const Demo = DEMO ? dynamic(() => import("@/demo/kundeportal/admin-kunder")) : null;

export default function Page() {
  if (Demo) return <Demo />;
  return (
    <PermissionGate permission="customers.view">
      <AdminKunder />
    </PermissionGate>
  );
}
