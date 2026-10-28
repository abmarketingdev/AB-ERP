import { notFound } from "next/navigation";
import { IS_MOCK } from "@/lib/data-source";

/** Design sandboxes (mascot, patterns, form drafts) exist only in the demo build. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (!IS_MOCK) notFound();
  return <>{children}</>;
}
