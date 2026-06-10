import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  CrearVariedadInput,
  FastApiOperacionVariedad,
  FastApiVariedadDimPagina,
  mapPagina,
  mapVariedadDim,
} from "@/lib/schemas/catalogos";
import { requireApiRole, requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const DEFAULT_SIZE = 50;
const MAX_SIZE = 200;

function clamp(n: number, lo: number, hi: number, fb: number) {
  if (!Number.isFinite(n)) return fb;
  return Math.min(Math.max(Math.floor(n), lo), hi);
}

export async function GET(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const pagina = clamp(Number(url.searchParams.get("pagina") ?? "1"), 1, Number.MAX_SAFE_INTEGER, 1);
  const tamano = clamp(Number(url.searchParams.get("tamano") ?? String(DEFAULT_SIZE)), 1, MAX_SIZE, DEFAULT_SIZE);

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/catalogos/variedades/dim?pagina=${pagina}&tamano=${tamano}`,
    );
    const parsed = FastApiVariedadDimPagina.parse(raw);
    return NextResponse.json(mapPagina(parsed, mapVariedadDim));
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

  let body: CrearVariedadInput;
  try {
    const raw = await req.json();
    body = CrearVariedadInput.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  const breeder = body.breeder && body.breeder.length > 0 ? body.breeder : null;

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/catalogos/variedades/dim`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre_variedad: body.nombreVariedad,
          breeder,
        }),
      },
    );
    return NextResponse.json(FastApiOperacionVariedad.parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
