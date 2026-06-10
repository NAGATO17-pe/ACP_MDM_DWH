import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  ActualizarParametroInput,
  FastApiMensaje,
} from "@/lib/schemas/configuracion";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const NOMBRE_PATTERN = /^[A-Za-z0-9._-]+$/;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ nombre: string }> },
) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const { nombre } = await ctx.params;
  if (
    !nombre ||
    nombre.length > 120 ||
    !NOMBRE_PATTERN.test(nombre)
  ) {
    return NextResponse.json(
      { detail: "Nombre de parámetro inválido" },
      { status: 400 },
    );
  }

  let body: { valor: string };
  try {
    body = ActualizarParametroInput.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/config/parametros/${encodeURIComponent(nombre)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor: body.valor }),
      },
    );
    return NextResponse.json(FastApiMensaje.parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
