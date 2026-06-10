import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { isErrored } from "@/lib/control-center/etl-status";
import {
  FastApiLogCarga,
  type ActivityEvent,
} from "@/lib/schemas/control-center";

export const dynamic = "force-dynamic";

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = clamp(Number(url.searchParams.get("limit") ?? "10"), 1, 100);

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/auditoria/log-carga?limite=${limit}`,
    );
    const parsed = z.array(FastApiLogCarga).parse(raw);
    const data: ActivityEvent[] = parsed
      .filter((c) => c.fecha_fin != null || c.fecha_inicio != null) // skip sin timestamp
      .map((c) => {
        const kind: ActivityEvent["kind"] = isErrored(c.estado) ? "error" : "etl";
        const ts = c.fecha_fin ?? c.fecha_inicio!;
        const rowsTxt =
          (c.filas_insertadas ?? 0) > 0
            ? ` — ${(c.filas_insertadas ?? 0).toLocaleString("es-PE")} filas`
            : "";
        const errTxt = c.mensaje_error ? ` — ${c.mensaje_error}` : "";
        return {
          id: `log-${c.id_log}`,
          at: ts,
          actor: null,
          kind,
          message: `${c.nombre_proceso} → ${c.estado}${rowsTxt}${errTxt}`,
        };
      });
    return NextResponse.json(data, {
      headers: { "cache-control": "private, max-age=15, stale-while-revalidate=30" },
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
