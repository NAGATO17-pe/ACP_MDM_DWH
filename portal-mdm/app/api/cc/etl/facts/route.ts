import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiFactDisponible,
  mapFactDisponible,
  type FactDisponible,
} from "@/lib/schemas/etl-launch";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/etl/facts`);
    const parsed = z.array(FastApiFactDisponible).parse(raw);
    const payload: FactDisponible[] = parsed
      .map(mapFactDisponible)
      .sort((a, b) => a.orden - b.orden);
    return NextResponse.json(payload, {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
