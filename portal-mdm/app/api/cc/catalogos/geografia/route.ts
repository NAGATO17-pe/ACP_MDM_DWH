import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiGeografiaPagina,
  mapGeografia,
  mapPagina,
} from "@/lib/schemas/catalogos";

export const dynamic = "force-dynamic";

const DEFAULT_SIZE = 50;
const MAX_SIZE = 200;

function clamp(n: number, lo: number, hi: number, fb: number) {
  if (!Number.isFinite(n)) return fb;
  return Math.min(Math.max(Math.floor(n), lo), hi);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pagina = clamp(Number(url.searchParams.get("pagina") ?? "1"), 1, Number.MAX_SAFE_INTEGER, 1);
  const tamano = clamp(Number(url.searchParams.get("tamano") ?? String(DEFAULT_SIZE)), 1, MAX_SIZE, DEFAULT_SIZE);

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/catalogos/geografia?pagina=${pagina}&tamano=${tamano}`,
    );
    const parsed = FastApiGeografiaPagina.parse(raw);
    return NextResponse.json(mapPagina(parsed, mapGeografia));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
