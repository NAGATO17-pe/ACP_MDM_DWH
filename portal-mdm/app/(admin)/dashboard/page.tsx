import type { Metadata } from "next";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { Dashboard } from "@/components/control-center/dashboard";
import { prefetchDashboard } from "@/lib/control-center/dashboard-prefetch";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Server Component del dashboard admin.
 *
 * Nivel 2: prefetchea las 6 queries del Control Center en el server
 * (paralelo con `Promise.allSettled`) y las inyecta vía
 * `HydrationBoundary`. Resultado: **el HTML del primer paint ya trae
 * los datos**, sin parpadeo de skeletons. Si el server falla por
 * algún motivo (timeout, downstream caído), el cliente cae al
 * comportamiento normal: skeleton + fetch en `useEffect`.
 */
export default async function AdminDashboardPage() {
  const qc = new QueryClient();
  await prefetchDashboard(qc);

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Dashboard
        title="Dashboard"
        description="Estado del ecosistema de datos en tiempo casi-real."
      />
    </HydrationBoundary>
  );
}
