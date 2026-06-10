import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  try {
    const views = await fastapiFetch("/api/v1/analista/vistas");
    return NextResponse.json(views);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error interno" }, { status: 502 });
  }
}
