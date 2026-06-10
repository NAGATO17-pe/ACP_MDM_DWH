"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  BitacoraEntry,
  BitacoraEstado,
  BitacoraPage,
  BitacoraResumen,
} from "@/lib/schemas/bitacora";
import type { z } from "zod";

/**
 * Hooks de Bitácora (Auditoría ETL).
 *
 * Todo I/O pasa por `/api/cc/bitacora/*`. Sin mutaciones — solo lectura.
 *
 * Cadencias:
 * - Listado: refetch 30 s cuando hay corridas EN_PROCESO en vista, 120 s en reposo.
 * - Resumen: refetch cada 60 s.
 * - Detalle: stale forever; se invalida explícitamente al abrir.
 */

const KEY_LIST = ["cc", "bitacora", "list"] as const;
const KEY_RESUMEN = ["cc", "bitacora", "resumen"] as const;
const KEY_DETAIL = ["cc", "bitacora", "detail"] as const;

async function fetchJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(path, { credentials: "include", cache: "no-store" });
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

export interface BitacoraListParams {
  pagina: number;
  tamano: number;
  estado?: BitacoraEstado[] | null;
  tabla?: string | null;
  desde?: string | null;
  hasta?: string | null;
  idCorrida?: string | null;
}

export function useBitacoraList(
  params: BitacoraListParams,
): UseQueryResult<BitacoraPage> {
  const { pagina, tamano, estado, tabla, desde, hasta, idCorrida } = params;
  const estadoKey = (estado ?? []).slice().sort().join(",");

  return useQuery({
    queryKey: [
      ...KEY_LIST,
      pagina,
      tamano,
      estadoKey,
      tabla ?? "",
      desde ?? "",
      hasta ?? "",
      idCorrida ?? "",
    ],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set("pagina", String(pagina));
      qs.set("tamano", String(tamano));
      if (estado && estado.length > 0) qs.set("estado", estado.join(","));
      if (tabla) qs.set("tabla", tabla);
      if (desde) qs.set("desde", desde);
      if (hasta) qs.set("hasta", hasta);
      if (idCorrida) qs.set("id_corrida", idCorrida);
      return fetchJson(`/api/cc/bitacora/list?${qs.toString()}`, BitacoraPage);
    },
    placeholderData: (prev) => prev,
    refetchInterval: (q) => {
      const data = q.state.data as BitacoraPage | undefined;
      const haveActive = data?.items.some(
        (it) => it.estado === "EN_PROCESO",
      );
      return haveActive ? 30_000 : 120_000;
    },
    staleTime: 20_000,
  });
}

export type VentanaResumen = 1 | 7 | 30;

export function useBitacoraResumen(
  ventana: VentanaResumen,
): UseQueryResult<BitacoraResumen> {
  return useQuery({
    queryKey: [...KEY_RESUMEN, ventana],
    queryFn: () =>
      fetchJson(
        `/api/cc/bitacora/resumen?ventana_dias=${ventana}`,
        BitacoraResumen,
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useBitacoraDetail(
  idLog: number | null,
): UseQueryResult<BitacoraEntry> {
  return useQuery({
    queryKey: [...KEY_DETAIL, idLog],
    queryFn: () =>
      fetchJson(`/api/cc/bitacora/${idLog}`, BitacoraEntry),
    enabled: idLog !== null,
    staleTime: Infinity,
  });
}
