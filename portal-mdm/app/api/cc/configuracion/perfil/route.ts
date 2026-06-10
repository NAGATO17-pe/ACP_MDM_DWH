import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { FastApiPerfil, mapPerfil } from "@/lib/schemas/configuracion";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  try {
    const raw = await fastapiFetch<unknown>(`/auth/me`);
    return NextResponse.json(mapPerfil(FastApiPerfil.parse(raw)));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
