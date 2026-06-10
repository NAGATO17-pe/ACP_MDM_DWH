import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { FastApiAccionAck } from "@/lib/schemas/control-center";

export const dynamic = "force-dynamic";

const PETICION = z.object({
  comentario: z.string().trim().max(500).optional(),
});

const ID_PATTERN = /^[A-Za-z0-9._:\-]+$/;

function validarId(raw: string): string | null {
  const id = raw.trim();
  if (id.length === 0 || id.length > 120) return null;
  if (!ID_PATTERN.test(id)) return null;
  return id;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const safeId = validarId(id);
  if (!safeId)
    return NextResponse.json({ detail: "ID de alerta inválido" }, { status: 400 });

  let body: z.infer<typeof PETICION> = {};
  try {
    const raw = await req.json().catch(() => ({}));
    body = PETICION.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  try {
    const data = await fastapiFetch<unknown>(
      `/api/v1/alertas/${encodeURIComponent(safeId)}/ack`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comentario: body.comentario ?? null }),
      },
    );
    return NextResponse.json(FastApiAccionAck.parse(data));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const safeId = validarId(id);
  if (!safeId)
    return NextResponse.json({ detail: "ID de alerta inválido" }, { status: 400 });

  try {
    const data = await fastapiFetch<unknown>(
      `/api/v1/alertas/${encodeURIComponent(safeId)}/ack`,
      { method: "DELETE" },
    );
    return NextResponse.json(FastApiAccionAck.parse(data));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
