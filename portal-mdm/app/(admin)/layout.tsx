import { requireAnyRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";
import { buildNavGroups } from "@/lib/routes";
import { PreferenciasProvider } from "@/components/providers/preferencias-provider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAnyRole(["admin", "analyst"]);
  const navItems = buildNavGroups(session.role).flatMap((g) => g.items);

  return (
    <RoleShell role={session.role} userName={session.name ?? session.username} navItems={navItems}>
      <PreferenciasProvider>{children}</PreferenciasProvider>
    </RoleShell>
  );
}
