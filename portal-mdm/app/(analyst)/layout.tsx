import { Compass, FlaskConical, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";

const NAV = [
  { href: "/explore", label: "Exploración", icon: <Compass aria-hidden className="h-4 w-4 shrink-0" /> },
  { href: "/models", label: "Modelos", icon: <FlaskConical aria-hidden className="h-4 w-4 shrink-0" /> },
  { href: "/reports", label: "Reportes", icon: <FileText aria-hidden className="h-4 w-4 shrink-0" /> },
];

export default async function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("analyst");

  return (
    <RoleShell role="analyst" userName={session.name ?? session.username} navItems={NAV}>
      {children}
    </RoleShell>
  );
}
