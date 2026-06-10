import { NextRequest, NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  try {
    const layout = await fastapiFetch("/api/v1/analista/home");
    return NextResponse.json(layout);
  } catch (err) {
    if (err instanceof FastApiError && err.status === 404) {
      return NextResponse.json({ widgets: [], savedAt: null });
    }
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error cargando workspace" }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Body inválido" }, { status: 400 });
  }

  try {
    const result = await fastapiFetch("/api/v1/analista/home", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FastApiError && err.status === 404) {
      return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
    }
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error guardando workspace" }, { status: 502 });
  }
}
