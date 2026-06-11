import { NextResponse } from "next/server";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { FastApiBitacoraPagina, mapBitacoraEntry } from "@/lib/schemas/bitacora";
import type { QualityTrendPoint } from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const days = Math.min(
    Number(new URL(req.url).searchParams.get("days") ?? 30) || 30,
    90,
  );

  const raw = await fastapiFetchSafe<unknown>(
    `/api/v1/auditoria/bitacora?pagina=1&tamano=500`,
  );
  const parsed = raw ? FastApiBitacoraPagina.safeParse(raw) : null;
  const entries = parsed?.success ? parsed.data.items.map(mapBitacoraEntry) : [];

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, { insertadas: number; rechazadas: number }>();

  for (const e of entries) {
    if (!e.fechaInicio) continue;
    const ts = new Date(e.fechaInicio).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    const day = e.fechaInicio.slice(0, 10);
    const acc = byDay.get(day) ?? { insertadas: 0, rechazadas: 0 };
    acc.insertadas += e.filasInsertadas;
    acc.rechazadas += e.filasRechazadas;
    byDay.set(day, acc);
  }

  const payload: QualityTrendPoint[] = [...byDay.entries()]
    .map(([date, v]) => ({
      date,
      insertadas: v.insertadas,
      rechazadas: v.rechazadas,
      tasaRechazo:
        v.insertadas + v.rechazadas > 0
          ? Math.round((v.rechazadas / (v.insertadas + v.rechazadas)) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(payload, {
    headers: { "cache-control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
