import { Database, GitPullRequestArrow, ShieldAlert, History } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";

const NAV = [
  { href: "/entities", label: "Entidades", icon: Database },
  { href: "/workflows", label: "Workflows", icon: GitPullRequestArrow },
  { href: "/quality", label: "Calidad de datos", icon: ShieldAlert },
  { href: "/audit", label: "Auditoría", icon: History },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("admin");

  return (
    <RoleShell role="admin" userName={session.name ?? session.email} navItems={NAV}>
      {children}
    </RoleShell>
  );
}
