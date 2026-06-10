import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { mapCorridaStatus } from "@/lib/control-center/etl-status";
import {
  FastApiDetalleCorrida,
  type CorridaDetail,
} from "@/lib/schemas/control-center";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

function durSec(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return Math.max(0, Math.round((e - s) / 1000));
}

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const { id } = await ctx.params;
  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/etl/corridas/${encodeURIComponent(id)}`,
    );
    const d = FastApiDetalleCorrida.parse(raw);

    const payload: CorridaDetail = {
      id: d.id_corrida,
      status: mapCorridaStatus(d.estado),
      startedBy: d.iniciado_por,
      comment: d.comentario ?? null,
      attempt: d.intento_numero,
      maxAttempts: d.max_reintentos,
      requestedAt: d.fecha_solicitud ?? null,
      startedAt: d.fecha_inicio ?? null,
      endedAt: d.fecha_fin ?? null,
      durationSec: durSec(d.fecha_inicio, d.fecha_fin),
      runnerPid: d.pid_runner ?? null,
      lastHeartbeat: d.heartbeat_ultimo ?? null,
      timeoutSec: d.timeout_segundos,
      finalMessage: d.mensaje_final ?? null,
      logId: d.id_log_auditoria ?? null,
      mode: d.modo_ejecucion,
      facts: d.facts,
      withDependencies: d.incluir_dependencias,
      refreshGold: d.refrescar_gold,
      forceBronzeReread: d.forzar_relectura_bronce,
      pasos: d.pasos.map((p) => ({
        idPaso: p.id_paso,
        nombre: p.nombre_paso,
        orden: p.orden,
        status: mapCorridaStatus(p.estado),
        startedAt: p.fecha_inicio ?? null,
        endedAt: p.fecha_fin ?? null,
        durationSec: durSec(p.fecha_inicio, p.fecha_fin),
        error: p.mensaje_error ?? null,
      })).sort((a, b) => a.orden - b.orden),
    };
    return NextResponse.json(payload);
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

export async function DELETE(req: Request, ctx: Ctx) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const { id } = await ctx.params;
  try {
    let comentario: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.comentario === "string") {
        comentario = body.comentario.slice(0, 500);
      }
    } catch { /* sin body, ok */ }

    const url = comentario
      ? `/api/v1/etl/corridas/${encodeURIComponent(id)}?comentario=${encodeURIComponent(comentario)}`
      : `/api/v1/etl/corridas/${encodeURIComponent(id)}`;

    await fastapiFetch(url, {
      method: "DELETE",
    });
    return NextResponse.json({ ok: true });
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
