import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiResumenBitacora,
  mapBitacoraResumen,
} from "@/lib/schemas/bitacora";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const VENTANAS_VALIDAS = new Set([1, 7, 30]);

export async function GET(req: Request) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const url = new URL(req.url);
  const raw = url.searchParams.get("ventana_dias");
  const ventana = raw ? Number.parseInt(raw, 10) : 7;
  const ventanaSegura = VENTANAS_VALIDAS.has(ventana) ? ventana : 7;

  try {
    const data = await fastapiFetch<unknown>(
      `/api/v1/auditoria/bitacora/resumen?ventana_dias=${ventanaSegura}`,
    );
    const parsed = FastApiResumenBitacora.parse(data);
    return NextResponse.json(mapBitacoraResumen(parsed));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
