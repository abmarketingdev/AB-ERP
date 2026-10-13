import { RoleShell } from "@/components/patterns/role-shell";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="onboarding">{children}</RoleShell>;
}
