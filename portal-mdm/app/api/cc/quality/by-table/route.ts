import { NextResponse } from "next/server";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { FastApiQuarantinePage, mapQuarantineRecord } from "@/lib/schemas/quality";
import type { QualityByTable } from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const raw = await fastapiFetchSafe<unknown>(
    `/api/v1/cuarentena?pagina=1&tamano=500`,
  );
  const parsed = raw ? FastApiQuarantinePage.safeParse(raw) : null;
  const records = parsed?.success ? parsed.data.datos.map(mapQuarantineRecord) : [];

  const byTable = new Map<string, { pendientes: number; resueltos: number; descartados: number }>();
  for (const r of records) {
    const acc = byTable.get(r.tablaOrigen) ?? { pendientes: 0, resueltos: 0, descartados: 0 };
    if (r.estado === "PENDIENTE") acc.pendientes += 1;
    else if (r.estado === "RESUELTO") acc.resueltos += 1;
    else acc.descartados += 1;
    byTable.set(r.tablaOrigen, acc);
  }

  const payload: QualityByTable[] = [...byTable.entries()]
    .map(([tabla, v]) => ({ tabla, ...v, total: v.pendientes + v.resueltos + v.descartados }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json(payload, {
    headers: { "cache-control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
