"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  ActivityEvent,
  Alert,
  CorridaDetail,
  DwhState,
  EtlRun,
  EtlTrendPoint,
  FactFreshness,
  QualityByTable,
  QualityKpis,
  QualityTrendPoint,
  SystemHealth,
} from "@/lib/schemas/control-center";
import { CorridaActiva } from "@/lib/schemas/etl-launch";
import {
  UnauthorizedError,
  dispatchSessionExpired,
} from "@/lib/api/session-events";

/**
 * Hooks del Control Center.
 *
 * Cada hook llama a un route handler local `/api/cc/*` que a su vez
 * consume el FastAPI real, reenvía el JWT desde la cookie httpOnly y
 * deriva/agrega cuando hace falta. Sin mocks, sin fallbacks.
 */

async function fetchAndParse<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) {
    // Dispatch inmediato: streams SSE deben cerrar antes del siguiente refetch
    dispatchSessionExpired();
    throw new UnauthorizedError(path);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String(body.detail);
      }
    } catch {
      /* ignore */
    }
    throw new Error(`${path} → ${res.status}: ${detail}`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `Respuesta del servidor no es JSON válido (status ${res.status}). ` +
        `Verifica que el backend esté corriendo.`,
    );
  }
  return schema.parse(data);
}

/**
 * Defaults aplicados a todas las queries del Control Center:
 *  - `placeholderData: keepPreviousData` evita el flash de skeleton
 *    entre refetches; el chart/tabla previa queda visible mientras
 *    llega el nuevo payload.
 *  - Intervalos espaciados (Nivel 1 de optimización): pasamos de
 *    ~14 req/min a ~6 req/min en el dashboard sin perder utilidad.
 */
export function useSystemHealth(): UseQueryResult<SystemHealth> {
  return useQuery({
    queryKey: ["cc", "health"],
    queryFn: () => fetchAndParse("/api/cc/health", SystemHealth),
    refetchInterval: 30_000,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Lista de corridas ETL activas (queued/running).
 *
 * Polling adaptivo: 5s cuando hay corridas activas, 30s cuando la lista
 * está vacía — reduce carga sin sacrificar reactividad. Si necesitas
 * pausarlo completamente, pasa `{ enabled: false }`.
 *
 * Esta es la definición canónica. `use-etl-launch.ts` la re-exporta para
 * evitar duplicar la queryKey `["cc","etl-active"]`.
 */
export function useActiveCorridas(opts?: {
  enabled?: boolean;
}): UseQueryResult<CorridaActiva[]> {
  return useQuery({
    queryKey: ["cc", "etl-active"],
    queryFn: () => fetchAndParse("/api/cc/etl/active", z.array(CorridaActiva)),
    // SLA: ≤5s con corridas activas, ≤30s en idle. Cambiar a 5_000 fijo si 30s es inaceptable.
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!Array.isArray(data)) return 5_000; // primer fetch o error: poll agresivo
      return data.length > 0 ? 5_000 : 30_000;
    },
    staleTime: 2_000,
    placeholderData: keepPreviousData,
    enabled: opts?.enabled ?? true,
  });
}

export function useEtlRuns(limit = 5): UseQueryResult<EtlRun[]> {
  return useQuery({
    queryKey: ["cc", "etl-runs", limit],
    queryFn: () =>
      fetchAndParse(`/api/cc/etl/runs?limit=${limit}`, z.array(EtlRun)),
    refetchInterval: 15_000,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useEtlTrend(days = 14): UseQueryResult<EtlTrendPoint[]> {
  return useQuery({
    queryKey: ["cc", "etl-trend", days],
    queryFn: () =>
      fetchAndParse(`/api/cc/etl/trend?days=${days}`, z.array(EtlTrendPoint)),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useQualityKpis(): UseQueryResult<QualityKpis> {
  return useQuery({
    queryKey: ["cc", "quality"],
    queryFn: () => fetchAndParse("/api/cc/quality", QualityKpis),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useDwhState(): UseQueryResult<DwhState> {
  return useQuery({
    queryKey: ["cc", "dwh"],
    queryFn: () => fetchAndParse("/api/cc/dwh", DwhState),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useFactFreshness(): UseQueryResult<FactFreshness[]> {
  return useQuery({
    queryKey: ["cc", "dwh-facts"],
    queryFn: () =>
      fetchAndParse("/api/cc/dwh/facts", z.array(FactFreshness)),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useActiveAlerts(): UseQueryResult<Alert[]> {
  return useQuery({
    queryKey: ["cc", "alerts"],
    queryFn: () => fetchAndParse("/api/cc/alerts", z.array(Alert)),
    // Push real-time via SSE; safety net: polling lento si el SSE cae.
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useCorridaDetail(id: string): UseQueryResult<CorridaDetail> {
  return useQuery({
    queryKey: ["cc", "etl-detail", id],
    queryFn: () =>
      fetchAndParse(
        `/api/cc/etl/runs/${encodeURIComponent(id)}`,
        CorridaDetail,
      ),
    refetchInterval: (q) => {
      const data = q.state.data as CorridaDetail | undefined;
      if (data?.status === "running" || data?.status === "queued") return 3_000;
      return false;
    },
    staleTime: 1_000,
    enabled: id.length > 0,
  });
}

interface CancelCorridaVars {
  id: string;
  comentario?: string;
}

export function useCancelCorrida(): UseMutationResult<
  unknown,
  Error,
  CancelCorridaVars
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comentario }: CancelCorridaVars) => {
      const path = `/api/cc/etl/runs/${encodeURIComponent(id)}`;
      const res = await fetch(path, {
        method: "DELETE",
        credentials: "include",
        ...(comentario
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ comentario }),
            }
          : {}),
      });
      if (res.status === 401) {
        dispatchSessionExpired();
        throw new UnauthorizedError(path);
      }
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = await res.json();
          if (body?.detail) detail = String(body.detail);
        } catch {
          /* ignore */
        }
        throw new Error(`Cancelar corrida → ${res.status}: ${detail}`);
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["cc", "etl-detail", id] });
      qc.invalidateQueries({ queryKey: ["cc", "etl-runs"] });
      qc.invalidateQueries({ queryKey: ["cc", "etl-trend"] });
    },
  });
}

export function useQualityTrend(
  days = 30,
): UseQueryResult<QualityTrendPoint[]> {
  return useQuery({
    queryKey: ["cc", "quality-trend", days],
    queryFn: () =>
      fetchAndParse(
        `/api/cc/quality/trend?days=${days}`,
        z.array(QualityTrendPoint),
      ),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useQualityByTable(): UseQueryResult<QualityByTable[]> {
  return useQuery({
    queryKey: ["cc", "quality-by-table"],
    queryFn: () =>
      fetchAndParse("/api/cc/quality/by-table", z.array(QualityByTable)),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useRecentActivity(
  limit = 10,
): UseQueryResult<ActivityEvent[]> {
  return useQuery({
    queryKey: ["cc", "activity", limit],
    queryFn: () =>
      fetchAndParse(
        `/api/cc/activity?limit=${limit}`,
        z.array(ActivityEvent),
      ),
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/* -------------------------------------------------------------------------- */
/* Ack persistente de alertas                                                 */
/* -------------------------------------------------------------------------- */

const ALERTS_KEY = ["cc", "alerts"] as const;

interface AckMutationVars {
  id: string;
  comentario?: string | null;
}

interface AckCtx {
  previous: Alert[] | undefined;
}

async function fetchOk(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
  });
  if (res.status === 401) {
    dispatchSessionExpired();
    throw new UnauthorizedError(path);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String(body.detail);
      }
    } catch {
      /* ignore */
    }
    throw new Error(`${path} → ${res.status}: ${detail}`);
  }
}

/**
 * Marca la alerta como atendida en el backend.
 * Aplica optimistic update sobre `["cc","alerts"]` y rollback si falla.
 */
export function useAckAlert(): UseMutationResult<
  void,
  Error,
  AckMutationVars,
  AckCtx
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comentario }: AckMutationVars) =>
      fetchOk(`/api/cc/alerts/${encodeURIComponent(id)}/ack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comentario: comentario ?? null }),
      }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = qc.getQueryData<Alert[]>(ALERTS_KEY);
      if (previous) {
        qc.setQueryData<Alert[]>(
          ALERTS_KEY,
          previous.map((a) =>
            a.id === id ? { ...a, acknowledged: true } : a,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ALERTS_KEY, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ALERTS_KEY });
    },
  });
}

/**
 * Reabre una alerta previamente atendida.
 */
export function useUnackAlert(): UseMutationResult<
  void,
  Error,
  { id: string },
  AckCtx
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      fetchOk(`/api/cc/alerts/${encodeURIComponent(id)}/ack`, {
        method: "DELETE",
      }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = qc.getQueryData<Alert[]>(ALERTS_KEY);
      if (previous) {
        qc.setQueryData<Alert[]>(
          ALERTS_KEY,
          previous.map((a) =>
            a.id === id
              ? {
                  ...a,
                  acknowledged: false,
                  ackedBy: null,
                  ackedAt: null,
                  ackComment: null,
                }
              : a,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ALERTS_KEY, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ALERTS_KEY });
    },
  });
}
