import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiCorridaActiva,
  mapCorridaActiva,
  type CorridaActiva,
} from "@/lib/schemas/etl-launch";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/etl/corridas/activas`);
    const parsed = z.array(FastApiCorridaActiva).parse(raw);
    const payload: CorridaActiva[] = parsed.map(mapCorridaActiva);
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
