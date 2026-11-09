import { Suspense } from "react";
import { redirect } from "next/navigation";
import { KundeSetPassword } from "@/components/kundeportal/kunde-set-password";

/*
 * Mock-bygg: demoen (src/demo/kundeportal, faste demo-kontoer). Api-bygg (produksjon): den ekte
 * kundeportalen mot hr-service. Vilkåret er en byggetidskonstant (NEXT_PUBLIC_* inlines), så
 * import() i den døde grenen aldri blir med i bygget — demo-kontoene finnes ikke i prod-bundelen.
 * Vilkåret MÅ stå i hver fil: en konstant importert fra en annen modul blir ikke brettet.
 */
const DEMO = process.env.NEXT_PUBLIC_DATA_SOURCE !== "api" && process.env.NEXT_PUBLIC_API_MOCKING !== "disabled";

export default function Page() {
  if (DEMO) redirect("/kunde/login"); // demoen har ingen lenker
  return (
    <Suspense>
      <KundeSetPassword />
    </Suspense>
  );
}
