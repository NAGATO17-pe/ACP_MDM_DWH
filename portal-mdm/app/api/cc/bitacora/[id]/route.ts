import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { FastApiLogCarga, mapBitacoraEntry } from "@/lib/schemas/bitacora";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await ctx.params;
  const idNum = Number.parseInt(id, 10);
  if (!Number.isFinite(idNum) || idNum <= 0)
    return NextResponse.json({ detail: "ID inválido" }, { status: 400 });

  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/auditoria/bitacora/${idNum}`);
    const parsed = FastApiLogCarga.parse(raw);
    return NextResponse.json(mapBitacoraEntry(parsed));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
