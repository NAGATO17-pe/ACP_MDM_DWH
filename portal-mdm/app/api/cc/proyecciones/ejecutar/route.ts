import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { EjecutarProyeccionInput, RespuestaProyeccion } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const body = EjecutarProyeccionInput.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json(
      { detail: "Petición inválida", issues: body.error.issues },
      { status: 422 },
    );
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/ejecutar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.data),
      timeoutMs: 120_000,
    });
    return NextResponse.json(RespuestaProyeccion.parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
