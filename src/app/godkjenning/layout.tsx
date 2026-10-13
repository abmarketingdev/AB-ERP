import { RoleShell } from "@/components/patterns/role-shell";

export default function GodkjenningLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="approval">{children}</RoleShell>;
}
