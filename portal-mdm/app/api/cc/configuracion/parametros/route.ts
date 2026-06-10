import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiParametrosPagina,
  mapParametro,
  type ParametrosPagina,
} from "@/lib/schemas/configuracion";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const MAX = 200;

function clamp(n: number, lo: number, hi: number, fb: number) {
  if (!Number.isFinite(n)) return fb;
  return Math.min(Math.max(Math.floor(n), lo), hi);
}

export async function GET(req: Request) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const url = new URL(req.url);
  const pagina = clamp(Number(url.searchParams.get("pagina") ?? "1"), 1, Number.MAX_SAFE_INTEGER, 1);
  const tamano = clamp(Number(url.searchParams.get("tamano") ?? "50"), 1, MAX, 50);

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/config/parametros?pagina=${pagina}&tamano=${tamano}`,
    );
    const parsed = FastApiParametrosPagina.parse(raw);
    const payload: ParametrosPagina = {
      total: parsed.total,
      pagina: parsed.pagina,
      tamano: parsed.tamano,
      datos: parsed.datos.map(mapParametro),
    };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
