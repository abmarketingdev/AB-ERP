import { RoleShell } from "@/components/patterns/role-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="recruitdash">{children}</RoleShell>;
}
