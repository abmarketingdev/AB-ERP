import { RoleShell } from "@/components/patterns/role-shell";

export default function AnsatteLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="employees">{children}</RoleShell>;
}
