import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import {
  FastApiFallosRecientes,
  FastApiHealth,
  FastApiResumenCuarentena,
  type StatusLevel,
  type SystemHealth,
} from "@/lib/schemas/control-center";

export const dynamic = "force-dynamic";

/**
 * Estado agregado del sistema.
 *
 * Optimización (Nivel 1): en lugar de bajar 50 corridas (`/api/v1/etl/corridas?limite=50`)
 * y filtrar las últimas 24 h en código, llamamos al endpoint dedicado
 * `/api/v1/etl/fallos-recientes` que retorna solo el conteo. Pasa de un
 * payload de ~50 corridas a ~3 campos por ciclo de polling (cada 30 s).
 *
 * Cada fuente upstream se llama en paralelo y de forma independiente
 * (`fastapiFetchSafe` retorna null en error). Si una falla, marcamos esa
 * sección como "critical" y seguimos — el dashboard nunca se queda
 * completamente en blanco por un endpoint caído.
 */
export async function GET() {
  const [healthRaw, fallosRaw, cuarentenaRaw] = await Promise.all([
    fastapiFetchSafe<unknown>("/health"),
    fastapiFetchSafe<unknown>("/api/v1/etl/fallos-recientes?horas=24"),
    fastapiFetchSafe<unknown>("/api/v1/cuarentena/resumen"),
  ]);

  const health = parseOr(FastApiHealth, healthRaw, null);
  const fallos = parseOr(FastApiFallosRecientes, fallosRaw, null);
  const cuarentena = parseOr(FastApiResumenCuarentena, cuarentenaRaw, null);

  // ETL: si no hay datos del conteo → critical; si hay → umbralizamos.
  let etl: StatusLevel = "critical";
  const recentFailed = fallos?.fallos ?? 0;
  if (fallos !== null) {
    etl = recentFailed === 0 ? "ok" : recentFailed >= 3 ? "critical" : "warning";
  }

  // Quality: si no hay datos → critical.
  let quality: StatusLevel = "critical";
  if (cuarentena) {
    quality =
      cuarentena.pendientes === 0
        ? "ok"
        : cuarentena.pendientes > 20
          ? "critical"
          : "warning";
  }

  // DWH: si /health responde "activo" → ok; resto → critical.
  const dwh: StatusLevel = health?.estado === "activo" ? "ok" : "critical";

  const all: StatusLevel[] = [etl, dwh, quality];
  const alerts: StatusLevel = all.includes("critical")
    ? "critical"
    : all.includes("warning")
      ? "warning"
      : "ok";

  const platform: StatusLevel =
    dwh === "critical"
      ? "critical"
      : all.includes("warning")
        ? "warning"
        : "ok";

  const activeCritical = recentFailed + (dwh === "critical" ? 1 : 0);
  const activeWarnings =
    (quality === "warning" ? 1 : 0) +
    (etl === "warning" ? recentFailed : 0);

  const payload: SystemHealth = {
    etl,
    dwh,
    quality,
    alerts,
    activeCritical,
    activeWarnings,
    platform,
    updatedAt: new Date().toISOString(),
  };

  // Cache-Control (Nivel 2): el browser sirve la copia previa instantánea-
  // mente mientras revalida en background. Pareado con `placeholderData`
  // del cliente, elimina el "flash de skeleton" al refetchear.
  return NextResponse.json(payload, {
    headers: {
      "cache-control": "private, max-age=10, stale-while-revalidate=20",
    },
  });
}

function parseOr<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  fallback: T | null,
): T | null {
  if (raw == null) return fallback;
  const r = schema.safeParse(raw);
  if (!r.success) {
    console.error("[cc/health] zod parse failed:", r.error.issues.slice(0, 3));
    return fallback;
  }
  return r.data;
}
