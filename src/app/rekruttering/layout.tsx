import { RoleShell } from "@/components/patterns/role-shell";

export default function RekrutteringLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="recruitment">{children}</RoleShell>;
}
