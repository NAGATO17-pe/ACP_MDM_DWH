import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { mapCorridaStatus } from "@/lib/control-center/etl-status";
import { FastApiLogCarga, type EtlRun } from "@/lib/schemas/control-center";
import {
  FastApiCorridaIniciada,
  LanzarCorridaInput,
  mapCorridaIniciada,
} from "@/lib/schemas/etl-launch";
import { clamp } from "@/lib/utils";
import { requireApiRole, requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const limit = clamp(Number(url.searchParams.get("limit") ?? "10"), 1, 100);

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/etl/corridas?limite=${limit}`,
    );
    const parsed = z.array(FastApiLogCarga).parse(raw);
    const data: EtlRun[] = parsed.map((c) => ({
      id: String(c.id_log),
      corridaId: c.id_corrida ?? null,
      name: c.nombre_proceso,
      status: mapCorridaStatus(c.estado),
      startedAt: c.fecha_inicio ?? null,
      endedAt: c.fecha_fin ?? null,
      durationSec: c.duracion_segundos ?? null,
      rowsProcessed: c.filas_insertadas ?? null,
      rowsRejected: c.filas_rechazadas ?? null,
      table: c.tabla_destino,
      error: c.mensaje_error ?? null,
    }));
    return NextResponse.json(data);
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

export async function POST(req: Request) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  let input: z.infer<typeof LanzarCorridaInput>;
  try {
    input = LanzarCorridaInput.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  // Validación de coherencia (espejo del backend) — falla rápido.
  if (input.modoEjecucion === "facts" && (!input.facts || input.facts.length === 0)) {
    return NextResponse.json(
      { detail: "Debes seleccionar al menos un fact cuando el modo es 'facts'." },
      { status: 400 },
    );
  }

  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/etl/corridas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        comentario: input.comentario ?? null,
        modo_ejecucion: input.modoEjecucion,
        facts: input.modoEjecucion === "facts" ? input.facts : null,
        incluir_dependencias: input.incluirDependencias,
        refrescar_gold: input.refrescarGold,
        forzar_relectura_bronce: input.forzarRelecturaBronce,
      }),
    });
    const parsed = FastApiCorridaIniciada.parse(raw);
    return NextResponse.json(mapCorridaIniciada(parsed));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
