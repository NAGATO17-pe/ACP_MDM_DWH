import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import {
  FastApiQuarantineAction,
  mapQuarantineAction,
} from "@/lib/schemas/quality";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const Body = z.object({
  valorCanonico: z.string().min(1).max(200),
  comentario: z.string().max(500).optional().nullable(),
});

interface Ctx {
  params: Promise<{ tabla: string; id: string }>;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { error } = await requireApiRole("admin");
  if (error) return error;

  const { tabla, id } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Body inválido" },
      { status: 400 },
    );
  }

  try {
    const raw = await fastapiFetch<unknown>(
      `/api/v1/cuarentena/${encodeURIComponent(tabla)}/${encodeURIComponent(id)}/resolver`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          valor_canonico: body.valorCanonico,
          comentario: body.comentario ?? null,
        }),
      },
    );
    const parsed = FastApiQuarantineAction.parse(raw);
    return NextResponse.json(mapQuarantineAction(parsed));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
