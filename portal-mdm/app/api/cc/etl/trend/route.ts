import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { isErrored, isSuccess } from "@/lib/control-center/etl-status";
import {
  FastApiLogCarga,
  type EtlTrendPoint,
} from "@/lib/schemas/control-center";
import { clamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = clamp(Number(url.searchParams.get("days") ?? "14"), 1, 90);

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/etl/corridas?limite=500`,
    );
    const parsed = z.array(FastApiLogCarga).parse(raw);

    const buckets = new Map<string, { success: number; failed: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(toKey(d), { success: 0, failed: 0 });
    }

    for (const c of parsed) {
      const when = c.fecha_inicio ?? c.fecha_fin;
      if (!when) continue;
      const key = toKey(new Date(when));
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (isErrored(c.estado)) bucket.failed++;
      else if (isSuccess(c.estado)) bucket.success++;
    }

    const points: EtlTrendPoint[] = [...buckets.entries()].map(([key, v]) => ({
      date: key,           // YYYY-MM-DD completo
      success: v.success,
      failed: v.failed,
    }));
    return NextResponse.json(points, {
      headers: { "cache-control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json(
        { detail: err.message },
        { status: err.status },
      );
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
