import dynamic from "next/dynamic";
import { KundeShell } from "@/components/kundeportal/kunde-shell";

/*
 * Mock-bygg: demoen (src/demo/kundeportal, faste demo-kontoer). Api-bygg (produksjon): den ekte
 * kundeportalen mot hr-service. Vilkåret er en byggetidskonstant (NEXT_PUBLIC_* inlines), så
 * import() i den døde grenen aldri blir med i bygget — demo-kontoene finnes ikke i prod-bundelen.
 * Vilkåret MÅ stå i hver fil: en konstant importert fra en annen modul blir ikke brettet.
 */
const DEMO = process.env.NEXT_PUBLIC_DATA_SOURCE !== "api" && process.env.NEXT_PUBLIC_API_MOCKING !== "disabled";
const Demo = DEMO ? dynamic(() => import("@/demo/kundeportal/kunde-layout")) : null;

export default function KundeLayout({ children }: { children: React.ReactNode }) {
  return Demo ? <Demo>{children}</Demo> : <KundeShell>{children}</KundeShell>;
}
