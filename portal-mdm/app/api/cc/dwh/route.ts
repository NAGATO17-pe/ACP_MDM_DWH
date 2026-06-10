import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { isErrored, isSuccess } from "@/lib/control-center/etl-status";
import {
  FastApiFact,
  FastApiLogCarga,
  type DwhState,
} from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  const [factsRaw, corridasRaw] = await Promise.all([
    fastapiFetchSafe<unknown>(`/api/v1/etl/facts`),
    fastapiFetchSafe<unknown>(`/api/v1/etl/corridas?limite=100`),
  ]);

  const factsParsed = factsRaw ? z.array(FastApiFact).safeParse(factsRaw) : null;
  const corridasParsed = corridasRaw
    ? z.array(FastApiLogCarga).safeParse(corridasRaw)
    : null;

  const facts = factsParsed?.success ? factsParsed.data : [];
  const corridas = corridasParsed?.success ? corridasParsed.data : [];

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let rowsLast24h = 0;
  let rejectedLast24h = 0;
  let failedLast24h = 0;
  let lastSuccessAt: string | null = null;

  for (const c of corridas) {
    const when = c.fecha_fin ?? c.fecha_inicio ?? null;
    if (!when) continue;
    const ts = new Date(when).getTime();
    const isRecent = now - ts < day;
    if (isRecent) {
      rowsLast24h += c.filas_insertadas ?? 0;
      rejectedLast24h += c.filas_rechazadas ?? 0;
      if (isErrored(c.estado)) failedLast24h++;
    }
    if (isSuccess(c.estado) && c.fecha_fin) {
      if (!lastSuccessAt || new Date(c.fecha_fin) > new Date(lastSuccessAt)) {
        lastSuccessAt = c.fecha_fin;
      }
    }
  }

  const payload: DwhState = {
    tables: facts.length,
    rowsLast24h,
    rejectedLast24h,
    failedLast24h,
    lastSuccessAt,
  };
  return NextResponse.json(payload, {
    headers: { "cache-control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
