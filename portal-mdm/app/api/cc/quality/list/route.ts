import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiQuarantinePage,
  mapQuarantineRecord,
  type QuarantinePage,
} from "@/lib/schemas/quality";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const MIN_PAGE = 1;
const MIN_SIZE = 1;
const MAX_SIZE = 200;
const DEFAULT_SIZE = 25;

function clampInt(raw: string | null, min: number, max: number, fallback: number) {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const pagina = clampInt(url.searchParams.get("pagina"), MIN_PAGE, Number.MAX_SAFE_INTEGER, 1);
  const tamano = clampInt(url.searchParams.get("tamano"), MIN_SIZE, MAX_SIZE, DEFAULT_SIZE);
  const tablaFiltro = url.searchParams.get("tabla")?.trim() || null;

  const qs = new URLSearchParams({
    pagina: String(pagina),
    tamano: String(tamano),
  });
  if (tablaFiltro) qs.set("tabla_filtro", tablaFiltro);

  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/cuarentena?${qs.toString()}`);
    const page = FastApiQuarantinePage.parse(raw);
    const payload: QuarantinePage = {
      total: page.total,
      pagina: page.pagina,
      tamano: page.tamano,
      datos: page.datos.map(mapQuarantineRecord),
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
