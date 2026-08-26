import { RoleShell } from "@/components/patterns/role-shell";

export default function PromoterLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="promoter">{children}</RoleShell>;
}
