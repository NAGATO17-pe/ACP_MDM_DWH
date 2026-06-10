import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { FastApiMensaje } from "@/lib/schemas/configuracion";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const PATTERN = /^[A-Za-z0-9._-]+$/;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ nombre: string }> },
) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const { nombre } = await ctx.params;
  if (!nombre || nombre.length > 100 || !PATTERN.test(nombre)) {
    return NextResponse.json(
      { detail: "Nombre de usuario inválido" },
      { status: 400 },
    );
  }

  try {
    const raw = await fastapiFetch<unknown>(
      `/auth/usuarios/${encodeURIComponent(nombre)}/activar`,
      { method: "POST" },
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
