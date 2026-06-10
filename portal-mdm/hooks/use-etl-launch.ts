"use client";

import {
  dispatchSessionExpired,
  UnauthorizedError,
} from "@/lib/api/session-events";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  CorridaIniciada,
  FactDisponible,
  type LanzarCorridaInput,
} from "@/lib/schemas/etl-launch";
import { useActiveCorridas } from "@/hooks/use-control-center";

/**
 * Hooks para lanzar corridas ETL desde el portal.
 *
 * - `useFactCatalog`: catálogo de facts (estable, cache largo).
 * - `useActiveCorridas`: re-exportado desde `use-control-center` (canónico).
 *   La queryKey `["cc","etl-active"]` vive en un único lugar para que
 *   TanStack Query no duplique suscripciones ni mezcle intervalos de polling.
 * - `useLaunchCorrida`: mutación que dispara POST y devuelve la corrida creada.
 */

/**
 * Re-exportado desde use-control-center para compatibilidad con imports existentes.
 * Fuente canónica: @/hooks/use-control-center — preferir importar desde ahí directamente.
 */
export { useActiveCorridas };

const ETL_QUERY_KEYS = {
  FACTS:  ["cc", "etl-facts"] as const,
  ACTIVE: ["cc", "etl-active"] as const,
} as const;

async function fetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) {
      dispatchSessionExpired();
      throw new UnauthorizedError(path);
    }
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object") {
        const d = (body as Record<string, unknown>);
        detail = String(d.detail ?? d.error ?? d.message ?? res.statusText);
      }
    } catch (parseErr) {
      console.warn("[ETL] Parse de detalle de error falló:", parseErr);
    }
    const err = new Error(`${path} → ${res.status}: ${detail}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return schema.parse(await res.json());
}

export function useFactCatalog(): UseQueryResult<FactDisponible[]> {
  return useQuery({
    queryKey: ETL_QUERY_KEYS.FACTS,
    queryFn: () => fetchJson("/api/cc/etl/facts", z.array(FactDisponible)),
    staleTime: 5 * 60_000, // catálogo cambia rara vez
  });
}

export function useLaunchCorrida(): UseMutationResult<
  CorridaIniciada,
  Error,
  LanzarCorridaInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      fetchJson("/api/cc/etl/runs", CorridaIniciada, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ETL_QUERY_KEYS.ACTIVE });
      qc.invalidateQueries({ queryKey: ["cc", "etl-runs"] });
      qc.invalidateQueries({ queryKey: ["cc", "etl-trend"] });
    },
  });
}
