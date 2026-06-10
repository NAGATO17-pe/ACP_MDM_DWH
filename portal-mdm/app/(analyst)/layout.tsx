import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";
import { buildNavGroups } from "@/lib/routes";

export default async function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("analyst");
  const navItems = buildNavGroups("analyst").flatMap((g) => g.items);

  return (
    <RoleShell
      role="analyst"
      userName={session.name ?? session.username}
      navItems={navItems}
    >
      {children}
    </RoleShell>
  );
}
