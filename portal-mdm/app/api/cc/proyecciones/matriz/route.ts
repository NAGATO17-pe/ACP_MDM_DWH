import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { MatrizInputs } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/matriz`);
    const parsed = MatrizInputs.safeParse(raw);
    return NextResponse.json(parsed.success ? parsed.data : {});
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
  const { error } = await requireApiSession();
  if (error) return error;
  const body = MatrizInputs.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json(
      { detail: "Matriz inválida: valores deben estar en [0,1] o null" },
      { status: 422 },
    );
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/matriz`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.data),
    });
    return NextResponse.json(raw);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
