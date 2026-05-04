import { Database, GitPullRequestArrow, ShieldAlert, History } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";

const NAV = [
  { href: "/entities", label: "Entidades", icon: <Database aria-hidden className="h-4 w-4 shrink-0" /> },
  { href: "/workflows", label: "Workflows", icon: <GitPullRequestArrow aria-hidden className="h-4 w-4 shrink-0" /> },
  { href: "/quality", label: "Calidad de datos", icon: <ShieldAlert aria-hidden className="h-4 w-4 shrink-0" /> },
  { href: "/audit", label: "Auditoría", icon: <History aria-hidden className="h-4 w-4 shrink-0" /> },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("admin");

  return (
    <RoleShell role="admin" userName={session.name ?? session.username} navItems={NAV}>
      {children}
    </RoleShell>
  );
}
