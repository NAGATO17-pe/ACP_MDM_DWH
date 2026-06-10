import { NextRequest, NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("page_size") ?? "25";
  const severidad = searchParams.get("severidad");

  const params = new URLSearchParams({ page, page_size: pageSize });
  if (severidad) params.set("severidad", severidad);

  try {
    const data = await fastapiFetch(`/api/v1/analista/notificaciones?${params}`);
    return NextResponse.json(data, {
      headers: { "cache-control": "private, max-age=15, stale-while-revalidate=30" },
    });
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error cargando notificaciones" }, { status: 502 });
  }
}
