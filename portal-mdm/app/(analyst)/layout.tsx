import { Compass, FlaskConical, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";

const NAV = [
  { href: "/explore", label: "Exploración", icon: Compass },
  { href: "/models", label: "Modelos", icon: FlaskConical },
  { href: "/reports", label: "Reportes", icon: FileText },
];

export default async function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("analyst");

  return (
    <RoleShell role="analyst" userName={session.name ?? session.email} navItems={NAV}>
      {children}
    </RoleShell>
  );
}
