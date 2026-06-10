"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  QuarantineActionResult,
  QuarantinePage,
} from "@/lib/schemas/quality";
import type { z } from "zod";

/**
 * Hooks de Calidad de Datos.
 *
 * Toda I/O pasa por `/api/cc/quality/*`. Mutaciones invalidan el listado
 * y los KPIs del dashboard para que ambos se mantengan consistentes.
 */

const KEY_LIST = ["cc", "quarantine-list"] as const;
const KEY_KPIS = ["cc", "quality"] as const;

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
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String((body as { detail: unknown }).detail);
      }
    } catch {
      /* ignore */
    }
    const err = new Error(`${path} → ${res.status}: ${detail}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return schema.parse(await res.json());
}

export interface QuarantineListParams {
  pagina: number;
  tamano: number;
  tabla?: string | null;
}

export function useQuarantineList(
  params: QuarantineListParams,
): UseQueryResult<QuarantinePage> {
  const { pagina, tamano, tabla } = params;
  return useQuery({
    queryKey: [...KEY_LIST, pagina, tamano, tabla ?? ""],
    queryFn: () => {
      const qs = new URLSearchParams({
        pagina: String(pagina),
        tamano: String(tamano),
      });
      if (tabla) qs.set("tabla", tabla);
      return fetchJson(`/api/cc/quality/list?${qs.toString()}`, QuarantinePage);
    },
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export interface ResolveInput {
  tabla: string;
  id: string;
  valorCanonico: string;
  comentario?: string | null;
}

export function useResolveQuarantine(): UseMutationResult<
  QuarantineActionResult,
  Error,
  ResolveInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tabla, id, valorCanonico, comentario }) =>
      fetchJson(
        `/api/cc/quality/${encodeURIComponent(tabla)}/${encodeURIComponent(id)}/resolver`,
        QuarantineActionResult,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ valorCanonico, comentario }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LIST });
      qc.invalidateQueries({ queryKey: KEY_KPIS });
    },
  });
}

export interface RejectInput {
  tabla: string;
  id: string;
  motivo: string;
}

export function useRejectQuarantine(): UseMutationResult<
  QuarantineActionResult,
  Error,
  RejectInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tabla, id, motivo }) =>
      fetchJson(
        `/api/cc/quality/${encodeURIComponent(tabla)}/${encodeURIComponent(id)}/rechazar`,
        QuarantineActionResult,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ motivo }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LIST });
      qc.invalidateQueries({ queryKey: KEY_KPIS });
    },
  });
}
