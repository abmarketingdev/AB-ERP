import { RoleShell } from "@/components/patterns/role-shell";

export default function LederLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="leader">{children}</RoleShell>;
}
