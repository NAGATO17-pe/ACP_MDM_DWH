import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { FastApiMensaje } from "@/lib/schemas/configuracion";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const PETICION = z.object({
  claveActual: z.string().min(1).max(200),
  claveNueva: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  let body: z.infer<typeof PETICION>;
  try {
    body = PETICION.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  try {
    const raw = await fastapiFetch<unknown>(`/auth/cambiar-clave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clave_actual: body.claveActual,
        clave_nueva: body.claveNueva,
      }),
    });
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
