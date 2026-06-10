import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiResumenCuarentena,
  type QualityKpis,
} from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/cuarentena/resumen`);
    const r = FastApiResumenCuarentena.parse(raw);
    const resolved = r.resueltos + r.descartados;
    const rate = r.total > 0 ? (resolved / r.total) * 100 : 100;
    const payload: QualityKpis = {
      total: r.total,
      pendientes: r.pendientes,
      resueltos: r.resueltos,
      descartados: r.descartados,
      resolutionRate: Number(rate.toFixed(1)),  // 1 decimal; redondeo intencional para UI
    };
    return NextResponse.json(payload, {
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
