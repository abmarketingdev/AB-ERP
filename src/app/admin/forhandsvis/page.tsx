import dynamic from "next/dynamic";

/*
 * Kundeportalen er foreløpig bare en demo (faste demo-kontoer, fast 2FA-kode, mock-data).
 * I api-bygg (produksjon) skal den verken kunne nås eller ligge i bundelen: next.config
 * omdirigerer rutene, og vilkåret under er en byggetidskonstant (NEXT_PUBLIC_* blir
 * inlinet), så import() i den døde grenen aldri blir med i bygget. Vilkåret MÅ stå i
 * hver fil: en konstant importert fra en annen modul blir ikke brettet av bundleren.
 */
const DEMO = process.env.NEXT_PUBLIC_DATA_SOURCE !== "api" && process.env.NEXT_PUBLIC_API_MOCKING !== "disabled";
const Demo = DEMO ? dynamic(() => import("@/demo/kundeportal/admin-forhandsvis")) : null;

export default function Page() {
  return Demo ? <Demo /> : null;
}
