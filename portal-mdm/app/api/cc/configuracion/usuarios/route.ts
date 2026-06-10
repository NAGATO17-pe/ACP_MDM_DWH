import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  CrearUsuarioInput,
  FastApiUsuario,
  mapUsuario,
} from "@/lib/schemas/configuracion";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  try {
    const raw = await fastapiFetch<unknown>(`/auth/usuarios`);
    const parsed = z.array(FastApiUsuario).parse(raw);
    return NextResponse.json(parsed.map(mapUsuario));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  let body: z.infer<typeof CrearUsuarioInput>;
  try {
    body = CrearUsuarioInput.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  const email = body.email && body.email.length > 0 ? body.email : null;

  try {
    const raw = await fastapiFetch<unknown>(`/auth/usuarios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nombre_usuario: body.nombreUsuario,
        nombre_display: body.nombreDisplay,
        email,
        clave: body.clave,
        rol: body.rol,
      }),
    });
    return NextResponse.json(mapUsuario(FastApiUsuario.parse(raw)));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
