import { RoleShell } from "@/components/patterns/role-shell";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="approval">{children}</RoleShell>;
}
