"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { DwhExplorerPayload } from "@/lib/schemas/dwh";

/**
 * Hook del DWH Explorer.
 *
 * Llama a `/api/cc/dwh/explorer` que agrega catálogo de facts + stats
 * recientes en un solo payload listo para renderizar el grafo.
 *
 * `autoRefresh` controla el polling cada 60s. Cuando se desactiva la
 * query queda estable hasta que el usuario presione "Refrescar".
 */
export function useDwhExplorer(opts?: {
  autoRefresh?: boolean;
}): UseQueryResult<DwhExplorerPayload> {
  const autoRefresh = opts?.autoRefresh ?? true;
  return useQuery({
    queryKey: ["cc", "dwh-explorer"],
    queryFn: async () => {
      const res = await fetch("/api/cc/dwh/explorer", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = await res.json();
          if (body && typeof body === "object" && "detail" in body) {
            detail = String((body as { detail: unknown }).detail);
          }
        } catch {
          /* ignore */
        }
        throw new Error(`DWH Explorer → ${res.status}: ${detail}`);
      }
      return DwhExplorerPayload.parse(await res.json());
    },
    refetchInterval: autoRefresh ? 60_000 : false,
    staleTime: 30_000,
  });
}
