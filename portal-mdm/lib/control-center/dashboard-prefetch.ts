import "server-only";

import { cookies, headers } from "next/headers";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ActivityEvent,
  Alert,
  DwhState,
  EtlTrendPoint,
  QualityKpis,
  SystemHealth,
} from "@/lib/schemas/control-center";

/**
 * Prefetch server-side de las queries del dashboard.
 *
 * Llama a los route handlers `/api/cc/*` desde el server (mismo
 * proceso) reenviando la cookie httpOnly. Las 6 llamadas corren en
 * paralelo con `Promise.allSettled` — si una falla, el cliente la
 * volverá a intentar al hidratar y la caché queda sin ese key. Las
 * que tuvieron éxito ya están "fresh" para `staleTime`, así que el
 * cliente NO dispara un refetch inmediato.
 *
 * Las queryKeys deben coincidir 1-a-1 con las usadas por los hooks
 * en `hooks/use-control-center.ts`.
 */
export async function prefetchDashboard(qc: QueryClient): Promise<void> {
  const origin = await getOrigin();
  if (!origin) return;

  const cookieHeader = await getCookieHeader();

  async function prefetch<T>(
    key: readonly unknown[],
    path: string,
    schema: z.ZodType<T>,
  ) {
    try {
      const res = await fetch(`${origin}${path}`, {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      });
      if (!res.ok) return;
      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) return;
      qc.setQueryData(key, parsed.data);
    } catch (err) {
      console.warn(
        `[prefetch] Query falló:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 6 prefetches en paralelo — replica los hooks 1-a-1.
  await Promise.allSettled([
    prefetch(["cc", "health"], "/api/cc/health", SystemHealth),
    prefetch(["cc", "alerts"], "/api/cc/alerts", z.array(Alert)),
    prefetch(["cc", "etl-trend", 14], "/api/cc/etl/trend?days=14", z.array(EtlTrendPoint)),
    prefetch(["cc", "quality"], "/api/cc/quality", QualityKpis),
    prefetch(["cc", "dwh"], "/api/cc/dwh", DwhState),
    prefetch(["cc", "activity", 6], "/api/cc/activity?limit=6", z.array(ActivityEvent)),
  ]);
}

/**
 * Construye el origin del request actual desde los headers de Next.js.
 * Soporta despliegues detrás de proxy (x-forwarded-host/proto).
 */
async function getOrigin(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto =
      h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    if (!host) return null;
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

async function getCookieHeader(): Promise<string | null> {
  try {
    const c = await cookies();
    const all = c.getAll();
    if (all.length === 0) return null;
    // Next.js garantiza que los valores de cookies están correctamente encoded
    return all.map((k) => `${k.name}=${k.value}`).join("; ");
  } catch {
    return null;
  }
}
