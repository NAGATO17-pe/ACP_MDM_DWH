import "server-only";

import { cookies, headers } from "next/headers";
import { QueryClient } from "@tanstack/react-query";
import { QualityKpis } from "@/lib/schemas/control-center";

/**
 * Prefetch server-side de los KPIs de calidad.
 *
 * Precarga ["cc", "quality"] para que QualityPage llegue hidratada al
 * cliente sin flash de skeleton. El listado de cuarentena no se prefetchea
 * porque depende de parámetros de paginación que sólo el cliente conoce.
 */
export async function prefetchQuality(qc: QueryClient): Promise<void> {
  const origin = await getOrigin();
  if (!origin) return;

  const cookieHeader = await getCookieHeader();

  try {
    const res = await fetch(`${origin}/api/cc/quality`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!res.ok) return;
    const parsed = QualityKpis.safeParse(await res.json());
    if (!parsed.success) return;
    qc.setQueryData(["cc", "quality"], parsed.data);
  } catch {
    // El cliente refetcheará al montar.
  }
}

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
    return all.map((k) => `${k.name}=${k.value}`).join("; ");
  } catch {
    return null;
  }
}
