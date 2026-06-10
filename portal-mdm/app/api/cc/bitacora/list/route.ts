import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  BitacoraEstado,
  FastApiBitacoraPagina,
  mapBitacoraPage,
} from "@/lib/schemas/bitacora";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const MIN_PAGE = 1;
const MIN_SIZE = 1;
const MAX_SIZE = 200;
const DEFAULT_SIZE = 50;

function clampInt(raw: string | null, min: number, max: number, fallback: number) {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const url = new URL(req.url);
  const pagina = clampInt(url.searchParams.get("pagina"), MIN_PAGE, Number.MAX_SAFE_INTEGER, 1);
  const tamano = clampInt(url.searchParams.get("tamano"), MIN_SIZE, MAX_SIZE, DEFAULT_SIZE);
  const tabla = url.searchParams.get("tabla")?.trim() || null;
  const desde = url.searchParams.get("desde")?.trim() || null;
  const hasta = url.searchParams.get("hasta")?.trim() || null;
  const idCorrida = url.searchParams.get("id_corrida")?.trim() || null;

  // Estados: aceptamos repetición (?estado=OK&estado=ERROR) y CSV (?estado=OK,ERROR).
  const estadosRaw = url.searchParams.getAll("estado").flatMap((v) => v.split(","));
  const estadosValidados = estadosRaw
    .map((e) => e.trim())
    .filter(Boolean)
    .filter((e): e is BitacoraEstado => BitacoraEstado.safeParse(e).success);

  const qs = new URLSearchParams();
  qs.set("pagina", String(pagina));
  qs.set("tamano", String(tamano));
  for (const e of estadosValidados) qs.append("estado", e);
  if (tabla) qs.set("tabla_destino", tabla);
  if (desde) qs.set("desde", desde);
  if (hasta) qs.set("hasta", hasta);
  if (idCorrida) qs.set("id_corrida", idCorrida);

  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/auditoria/bitacora?${qs.toString()}`);
    const parsed = FastApiBitacoraPagina.parse(raw);
    return NextResponse.json(mapBitacoraPage(parsed));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
