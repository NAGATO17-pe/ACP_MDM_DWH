import { LayoutDashboard } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";

const NAV = [{ href: "/overview", label: "Overview", icon: LayoutDashboard }];

export default async function ExecutiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("executive");

  return (
    <RoleShell role="executive" userName={session.name ?? session.email} navItems={NAV}>
      {children}
    </RoleShell>
  );
}
