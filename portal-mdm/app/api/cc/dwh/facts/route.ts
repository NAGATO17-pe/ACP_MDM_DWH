import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { isSuccess } from "@/lib/control-center/etl-status";
import {
  FactFreshness,
  FastApiFact,
  FastApiLogCarga,
} from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const [factsRaw, corridasRaw] = await Promise.all([
    fastapiFetchSafe<unknown>(`/api/v1/etl/facts`),
    fastapiFetchSafe<unknown>(`/api/v1/etl/corridas?limite=200`),
  ]);

  const factsParsed = factsRaw ? z.array(FastApiFact).safeParse(factsRaw) : null;
  const corridasParsed = corridasRaw
    ? z.array(FastApiLogCarga).safeParse(corridasRaw)
    : null;

  const facts = factsParsed?.success ? factsParsed.data : [];
  const corridas = corridasParsed?.success ? corridasParsed.data : [];

  const payload: FactFreshness[] = facts
    .map((fact) => {
      // Match corridas by tabla_destino (the destination table of the fact).
      // FastApiFact.tabla_destino and FastApiLogCarga.tabla_destino are both
      // the canonical identifier used when logging a fact run.
      let lastSuccessAt: string | null = null;

      for (const c of corridas) {
        if (!isSuccess(c.estado)) continue;
        if (!c.fecha_fin) continue;
        // Match on tabla_destino first; fall back to nombre_proceso for facts
        // that log by process name rather than destination table.
        const matches =
          c.tabla_destino === fact.tabla_destino ||
          c.nombre_proceso === fact.nombre_fact;
        if (!matches) continue;
        if (!lastSuccessAt || new Date(c.fecha_fin) > new Date(lastSuccessAt)) {
          lastSuccessAt = c.fecha_fin;
        }
      }

      return { name: fact.nombre_fact, lastSuccessAt };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(payload, {
    headers: {
      "cache-control": "private, max-age=30, stale-while-revalidate=60",
    },
  });
}
