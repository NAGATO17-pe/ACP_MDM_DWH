import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { z } from "zod";

export const dynamic = "force-dynamic";

const FastApiReinyeccionResult = z.object({
  reinyectados: z.number().optional().nullable(),
  mensaje: z.string().optional().nullable(),
});

export async function POST() {
  try {
    const raw = await fastapiFetch<unknown>("/api/v1/reinyeccion/ejecutar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const parsed = FastApiReinyeccionResult.parse(raw);
    return NextResponse.json({
      reinyectados: parsed.reinyectados ?? 0,
      mensaje: parsed.mensaje ?? null,
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
