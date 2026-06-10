import { NextRequest, NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Body inválido" }, { status: 400 });
  }

  try {
    const figure = await fastapiFetch("/api/v1/analista/widget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 30_000,
    });
    return NextResponse.json(figure);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error generando widget" }, { status: 502 });
  }
}
