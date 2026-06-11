import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { Combinacion } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

type Params = Promise<{ idTiempo: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { idTiempo } = await params;
  const id = Number(idTiempo);
  if (!Number.isInteger(id))
    return NextResponse.json({ detail: "idTiempo inválido" }, { status: 400 });
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/combinaciones/${id}`);
    return NextResponse.json(z.array(Combinacion).parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
